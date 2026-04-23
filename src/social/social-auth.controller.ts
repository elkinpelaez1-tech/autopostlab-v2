import { Controller, Get, Post, Body, Query, Res, Req, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { FacebookAuthService } from './facebook-auth.service';
import { LinkedinAuthService } from './linkedin-auth.service';
import { TikTokAuthService } from './tiktok-auth.service';
import { SocialAccountsService } from './social-accounts.service';
import { AuthService } from '../auth/auth.service';
import type { Response } from 'express';

@Controller('social-auth') // Con el prefix global /api, esto queda como /api/social-auth
export class SocialAuthController {
  private readonly logger = new Logger(SocialAuthController.name);

  constructor(
    private readonly facebookAuthService: FacebookAuthService,
    private readonly linkedinAuthService: LinkedinAuthService,
    private readonly tiktokAuthService: TikTokAuthService,
    private readonly socialAccountsService: SocialAccountsService,
    private readonly authService: AuthService,
  ) {
    this.logger.log('SOCIAL AUTH CONTROLLER LOADED');
    console.log('SOCIAL AUTH CONTROLLER LOADED');
  }

  // Diagnostic route
  @Get('check')
  check() {
    return { ok: true, controller: 'SocialAuthController' };
  }

  @Get('test')
  test() {
    return 'ok';
  }

  // 1. Iniciar flujo de Facebook
  @Get('facebook')
  async facebookAuth(@Query('workspaceId') workspaceId: string, @Res() res: Response) {
    this.logger.log(`Iniciando auth de Facebook para workspace: ${workspaceId}`);
    if (!workspaceId) {
      throw new InternalServerErrorException('WorkspaceId es requerido');
    }
    const url = this.facebookAuthService.getAuthorizationUrl(workspaceId);
    return res.redirect(url);
  }

  // 1b. Iniciar flujo de Instagram (usa la misma lógica de FB)
  @Get('instagram')
  async instagramAuth(@Query('workspaceId') workspaceId: string, @Res() res: Response) {
    this.logger.log(`Iniciando auth de Instagram para workspace: ${workspaceId}`);
    return this.facebookAuth(workspaceId, res);
  }


  // 2. Callback de Facebook (Redirect URI oficial)
  @Get('callback/facebook')
  async facebookCallback(
    @Query('code') code: string,
    @Query('state') workspaceId: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    console.log('🔥 FACEBOOK CALLBACK HIT');
    console.log('QUERY:', query);
    console.log('CODE:', code);
    console.log('STATE:', workspaceId);

    if (!code) {
      console.log('❌ NO CODE RECEIVED:', query);
      return res.status(400).json({ error: 'No code received', query });
    }

    try {
      console.log('STEP 1: code recibido:', code);
      this.logger.log(`Procesando callback de Facebook para workspace: ${workspaceId}`);

      // A. Intercambiar código por token de usuario
      console.log('STEP 2: intercambiando token...');
      const userToken = await this.facebookAuthService.exchangeCodeForToken(code);
      console.log('STEP 3: access_token obtenido:', userToken);

      // B. Obtener token de larga duración
      console.log('STEP 4: obteniendo token de larga duración...');
      const longLivedToken = await this.facebookAuthService.getLongLivedToken(userToken);
      console.log('STEP 5: long_lived_token obtenido:', longLivedToken);

      // C. Listar cuentas (Facebook Pages + Instagram Business)
      console.log('STEP 6: llamando /me/accounts...');
      const allAccounts = await this.facebookAuthService.getFacebookAndInstagramAccounts(longLivedToken);
      console.log('STEP 7: respuesta páginas conectadas:', allAccounts);

      if (allAccounts.length === 0) {
        console.log('ANTES DE REDIRECT DE NO ACCOUNTS');
        // return res.redirect(`https://autopostlab-v2.vercel.app/?error=no_accounts_found`);
        return res.json({ error: 'no_accounts_found', query, code, state: workspaceId });
      }

      // D. Guardar todas las cuentas encontradas (Upsert interno)
      for (const account of allAccounts) {
        this.logger.log(`Guardando/Actualizando cuenta ${account.provider}: ${account.username}`);
        console.log(`STEP 8: guardando cuenta ${account.username} en BD...`);
        const savedAccount = await this.socialAccountsService.create({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          username: account.username,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          accessToken: account.accessToken,
        }, workspaceId);
        console.log('ACCOUNT SAVED TO DB:', savedAccount);
      }

      // E. Redirigir de vuelta al Frontend
      console.log('ANTES DEL REDIRECT FINAL');
      // return res.redirect(`https://autopostlab-v2.vercel.app/success_connection=true`);
      return res.json({ success: true, query, code, state: workspaceId });
    } catch (error) {
      console.error('❌ ERROR FATAL EN CALLBACK FACEBOOK:', error);
      this.logger.error('Error en callback de Facebook:', error);
      // return res.redirect(`https://autopostlab-v2.vercel.app/?error=${encodeURIComponent(error.message)}`);
      return res.status(500).json({ error: error.message });
    }
  }

  // 3. Iniciar flujo de LinkedIn
  @Get('linkedin')
  async linkedinAuth(@Query('workspaceId') workspaceId: string, @Res() res: Response) {
    if (!workspaceId) {
      return res.status(400).send('Se requiere un workspaceId para conectar LinkedIn. Ej: ?workspaceId=ID_DEL_WORKSPACE');
    }
    this.logger.log(`Iniciando auth de LinkedIn para workspace: ${workspaceId}`);
    const url = this.linkedinAuthService.getAuthorizationUrl(workspaceId);
    console.log('AUTH URL:', url);
    return res.redirect(url);
  }

  // 4. Callback de LinkedIn
  @Get('callback/linkedin')
  async linkedinCallback(@Req() req, @Res() res: Response) {
    const { code, state: workspaceId } = req.query;

    console.log("🔥 LINKEDIN CALLBACK HIT");
    console.log("CODE:", code);
    console.log("WORKSPACE_ID (from state):", workspaceId);

    if (!code) {
      this.logger.error('No se recibió código de LinkedIn');
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab-v2.vercel.app';
      return res.redirect(`${frontendUrl}/?error=no_code_received`);
    }

    if (!workspaceId || workspaceId === 'undefined') {
      this.logger.error('No se recibió workspaceId en el state');
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab-v2.vercel.app';
      return res.redirect(`${frontendUrl}/?error=invalid_workspace`);
    }

    try {
      // 1. Intercambio de code por token
      const accessToken = await this.linkedinAuthService.exchangeCodeForToken(code);
      console.log("✅ LINKEDIN ACCESS TOKEN:", accessToken);

      // 2. Obtener información del usuario
      const userData = await this.linkedinAuthService.getUserProfile(accessToken);
      console.log("👤 LINKEDIN USER:", userData);

      // 3. Guardar en Base de Datos (Upsert)
      await this.socialAccountsService.create({
        provider: 'LINKEDIN',
        providerAccountId: userData.id,
        username: userData.email,
        displayName: userData.name,
        avatarUrl: userData.picture,
        accessToken: accessToken,
      }, workspaceId as string);

      // 4. Respuesta JSON (Temporalmente para evitar ERR_CONNECTION_REFUSED)
      return res.json({
        success: true,
        message: 'LinkedIn conectado correctamente',
        provider: 'linkedin',
        workspaceId
      });
    } catch (error) {
      this.logger.error('Error en callback de LinkedIn:', error);

      // Manejo específico de error de base de datos
      if (error.code === 'P2003') {
        return res.status(404).json({
          success: false,
          error: 'Workspace no encontrado',
          details: 'El workspaceId proporcionado no existe en la base de datos'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Error en la autenticación con LinkedIn',
        details: error.message
      });
    }
  }

  // 🛠 ENDPOINT DE EMERGENCIA PARA INTERCAMBIO MANUAL
  @Post('debug/force-token')
  async forceToken(
    @Body('code') code: string,
    @Body('workspaceId') workspaceId: string,
    @Body('redirectUri') redirectUri?: string,
  ) {
    this.logger.log(`[DEBUG] Forzando intercambio de token para workspace: ${workspaceId}`);

    try {
      const userToken = await this.facebookAuthService.exchangeCodeForToken(code, redirectUri);
      const longLivedToken = await this.facebookAuthService.getLongLivedToken(userToken);
      const allAccounts = await this.facebookAuthService.getFacebookAndInstagramAccounts(longLivedToken);

      if (allAccounts.length === 0) {
        return { success: false, message: 'No se encontraron cuentas vinculadas.' };
      }

      const results: any[] = [];
      for (const account of allAccounts) {
        const acc = await this.socialAccountsService.create({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          username: account.username,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          accessToken: account.accessToken,
        }, workspaceId);
        results.push(acc);
      }

      return {
        success: true,
        message: `Se conectaron ${allAccounts.length} cuentas exitosamente.`,
        accounts: results.map(a => ({ id: a.id, username: a.username, provider: a.provider }))
      };
    } catch (error) {
      this.logger.error('[DEBUG] Error en force-token:', error);
      return { success: false, error: error.message };
    }
  }

  // ----------------------------------------------------------
  // 📌 5. Iniciar flujo de TikTok
  // ----------------------------------------------------------
  @Get('tiktok')
  async tiktokAuth(@Query('workspaceId') workspaceId: string, @Res() res: Response) {
    this.logger.log(`Iniciando auth de TikTok para workspace: ${workspaceId}`);
    if (!workspaceId) {
      return res.status(400).json({ error: 'WorkspaceId es requerido' });
    }
    const url = this.tiktokAuthService.getAuthorizationUrl(workspaceId);
    return res.redirect(url);
  }

  // ----------------------------------------------------------
  // 📌 6. Callback de TikTok
  // ----------------------------------------------------------
  @Get('callback/tiktok')
  async tiktokCallback(
    @Query('code') code: string,
    @Query('state') workspaceId: string,
    @Query('error') errorDesc: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Procesando callback de TikTok para workspace: ${workspaceId}`);

    if (errorDesc || !code) {
      this.logger.error(`Error en callback de TikTok: ${errorDesc}`);
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab-v2.vercel.app';
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=tiktok_auth_failed`);
    }

    try {
      // A. Intercambiar código por tokens
      const tokenData = await this.tiktokAuthService.exchangeCodeForToken(code);

      // B. Obtener información del perfil
      const userData = await this.tiktokAuthService.getUserProfile(tokenData.accessToken);

      // C. Guardar en Base de Datos (Upsert)
      await this.socialAccountsService.create({
        provider: 'TIKTOK',
        providerAccountId: userData.openId,
        username: userData.username,
        displayName: userData.displayName,
        avatarUrl: userData.avatarUrl,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        accessTokenExpires: tokenData.expiresAt,
      }, workspaceId);

      // D. Redirigir al Frontend con éxito
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab-v2.vercel.app';
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?success=true&provider=tiktok`);
    } catch (error) {
      this.logger.error('Error fatal en callback de TikTok:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab-v2.vercel.app';
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=${encodeURIComponent(error.message)}`);
    }
  }

  // ----------------------------------------------------------
  // 📌 Publicar en LinkedIn
  // ----------------------------------------------------------
  @Post('linkedin/post')
  async linkedinPost(@Body() body: { workspaceId: string; text: string }) {
    const { workspaceId, text } = body;

    if (!workspaceId || !text) {
      throw new InternalServerErrorException('Se requiere workspaceId y text en el body');
    }

    // 1. Buscar la cuenta de LinkedIn en la base de datos
    const account = await this.socialAccountsService.findByWorkspaceAndProvider(
      workspaceId,
      'LINKEDIN'
    );

    if (!account) {
      throw new NotFoundException('No se encontró una cuenta de LinkedIn conectada para este workspace');
    }

    try {
      // 2. Publicar en LinkedIn
      const result = await this.linkedinAuthService.createPost(
        account.accessToken,
        account.providerAccountId,
        text
      );

      return {
        success: true,
        message: 'Post publicado en LinkedIn',
        data: result,
      };
    } catch (error) {
      this.logger.error('Error publicando en LinkedIn:', error);
      throw new InternalServerErrorException(error.message || 'Error al publicar en LinkedIn');
    }
  }

  // ----------------------------------------------------------
  // 📌 7. Iniciar flujo de Google
  // ----------------------------------------------------------
  @Get('google')
  async googleAuth(@Query('workspaceId') workspaceId: string, @Res() res: Response) {
    this.logger.log(`Iniciando auth de Google para workspace: ${workspaceId || 'Login'}`);
    console.log('GOOGLE ROUTE HIT');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "https://autopostlab-v2-2.onrender.com/api/social-auth/callback/google";

    if (!clientId) {
      this.logger.error('GOOGLE_CLIENT_ID no está configurada');
      return res.status(500).json({ error: 'Configuración de Google incompleta en el servidor' });
    }

    const scope = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');

    const state = workspaceId || 'login';

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

    return res.redirect(url);
  }

  // ----------------------------------------------------------
  // 📌 8. Callback de Google
  // ----------------------------------------------------------
  @Get('callback/google')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Callback de Google recibido. State: ${state}`);

    try {
      // 1. Intercambiar code por tokens (access_token e id_token)
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || "https://autopostlab-v2-2.onrender.com/api/social-auth/callback/google",
          grant_type: 'authorization_code',
        }),
      });

      const tokens: any = await tokenResponse.json();

      if (tokens.error) {
        this.logger.error('Error intercambiando código de Google:', tokens.error_description || tokens.error);
        throw new Error(tokens.error_description || tokens.error);
      }

      const { id_token } = tokens;

      // 2. Usar AuthService para realizar el login/registro silencioso y obtener JWT de Autopostlab
      const loginResult = await this.authService.loginWithGoogle(id_token);

      // 3. Redirigir al frontend con los tokens de acceso
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab-v2.vercel.app';
      const redirectUrl = `${frontendUrl}/dashboard?token=${loginResult.accessToken}&refreshToken=${loginResult.refreshToken}`;

      this.logger.log(`Login exitoso para ${loginResult.user.email}. Redirigiendo a ${frontendUrl}...`);
      return res.redirect(redirectUrl);

    } catch (error) {
      this.logger.error('Error crítico en Google Callback:', error.message);
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab-v2.vercel.app';
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  }
}
