import { Controller, Get, Post, Body, Query, Res, Req, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { FacebookAuthService } from './facebook-auth.service';
import { LinkedinAuthService } from './linkedin-auth.service';
import { TikTokAuthService } from './tiktok-auth.service';
import { SocialAccountsService } from './social-accounts.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Response } from 'express';

@Controller('social-auth') // Con el prefix global /api, esto queda como /api/social-auth
export class SocialAuthController {
  private readonly logger = new Logger(SocialAuthController.name);

  /**
   * In-process cache to track used OAuth state signatures and protect against replay attacks.
   * NOTE: This in-memory cache is local to the current Node.js process. It does not provide
   * distributed protection across multiple cluster instances or serverless replicas, nor does
   * it survive server restarts. For multi-instance production environments, an external shared
   * store such as Redis or a database table should be used.
   */
  public static readonly usedSignaturesCache = new Map<string, number>();
  public static readonly STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  public static readonly MAX_CLOCK_SKEW_MS = 60 * 1000; // 1 minute allowed into future

  public static cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [sig, timestamp] of SocialAuthController.usedSignaturesCache.entries()) {
      if (now - timestamp > SocialAuthController.STATE_TTL_MS) {
        SocialAuthController.usedSignaturesCache.delete(sig);
      }
    }
  }

  public static resetStateCache(): void {
    SocialAuthController.usedSignaturesCache.clear();
  }

  constructor(
    private readonly facebookAuthService: FacebookAuthService,
    private readonly linkedinAuthService: LinkedinAuthService,
    private readonly tiktokAuthService: TikTokAuthService,
    private readonly socialAccountsService: SocialAccountsService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('SOCIAL AUTH CONTROLLER LOADED');
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
  async facebookAuth(
    @Query('workspaceId') workspaceId: string,
    @Query('requestPagePublish') requestPagePublish: string,
    @Res() res: Response
  ) {
    this.logger.log(`Iniciando auth de Facebook para workspace: ${workspaceId}, requestPagePublish: ${requestPagePublish}`);
    if (!workspaceId) {
      throw new InternalServerErrorException('WorkspaceId es requerido');
    }
    const url = this.facebookAuthService.getAuthorizationUrl(workspaceId, requestPagePublish === 'true');
    return res.redirect(url);
  }

  // 1b. Iniciar flujo de Instagram (usa la misma lógica de FB)
  @Get('instagram')
  async instagramAuth(
    @Query('workspaceId') workspaceId: string,
    @Query('requestPagePublish') requestPagePublish: string,
    @Res() res: Response
  ) {
    this.logger.log(`Iniciando auth de Instagram para workspace: ${workspaceId}, requestPagePublish: ${requestPagePublish}`);
    return this.facebookAuth(workspaceId, requestPagePublish, res);
  }


  // 2. Callback de Facebook (Redirect URI oficial)
  @Get('callback/facebook')
  async facebookCallback(
    @Query('code') code: string,
    @Query('state') workspaceId: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    this.logger.debug('Facebook callback hit');

    const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab.me';
    // Verify signed state when test mode is active
    const testMode = this.configService.get<string>('FB_OAUTH_TEST_MODE') === 'standard';
    if (testMode) {
      if (!workspaceId || typeof workspaceId !== 'string') {
        this.logger.warn('State missing or invalid in test mode');
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=invalid_state`);
      }

      const parts = workspaceId.split(':');
      if (parts.length !== 3) {
        this.logger.warn('Invalid state format in test mode (expected exactly 3 parts)');
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=invalid_state`);
      }

      const [rawWorkspaceId, timestampStr, providedSignature] = parts;
      if (!rawWorkspaceId || !timestampStr || !providedSignature) {
        this.logger.warn('State contains empty parts in test mode');
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=invalid_state`);
      }

      // 1. Validate workspaceId format: /^[A-Za-z0-9_-]{1,64}$/
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(rawWorkspaceId)) {
        this.logger.warn('Invalid workspaceId format in state');
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=invalid_workspace_id`);
      }

      // 2. Validate signature format: exactly 64 hex characters
      if (!/^[a-f0-9]{64}$/i.test(providedSignature)) {
        this.logger.warn('State signature malformed (not 64-char hex)');
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=invalid_state_signature_format`);
      }

      // 3. Verify secret presence
      const secret = this.configService.get<string>('FB_OAUTH_STATE_SECRET');
      if (!secret) {
        this.logger.error('Missing FB_OAUTH_STATE_SECRET in test mode');
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=missing_state_secret`);
      }

      // 4. Verify HMAC signature before timestamp expiration logic
      const expectedSignature = crypto.createHmac('sha256', secret).update(`${rawWorkspaceId}:${timestampStr}`).digest('hex');
      const providedBuf = Buffer.from(providedSignature, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');
      if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        this.logger.warn('State signature mismatch');
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=invalid_state_signature`);
      }

      // 5. Validate timestamp & expiration
      const stateTimestamp = Number(timestampStr);
      if (!Number.isInteger(stateTimestamp) || stateTimestamp <= 0) {
        this.logger.warn('State timestamp is not a valid integer');
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=state_expired`);
      }

      const now = Date.now();
      const age = now - stateTimestamp;
      if (age > SocialAuthController.STATE_TTL_MS) {
        this.logger.warn(`State expired: age ${age}ms exceeds TTL of ${SocialAuthController.STATE_TTL_MS}ms`);
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=state_expired`);
      }
      if (stateTimestamp - now > SocialAuthController.MAX_CLOCK_SKEW_MS) {
        this.logger.warn(`State timestamp is too far in future: ${stateTimestamp - now}ms`);
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=state_expired`);
      }

      // 6. Check replay protection & register state as used immediately
      SocialAuthController.cleanupExpiredStates();
      if (SocialAuthController.usedSignaturesCache.has(providedSignature)) {
        this.logger.warn('State already used (replay attack detected)');
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=invalid_state_reused`);
      }

      // Atomically mark signature as used in process cache before token exchange or DB access
      SocialAuthController.usedSignaturesCache.set(providedSignature, now);

      // Use the verified workspaceId for subsequent processing
      workspaceId = rawWorkspaceId;
    }

    if (!code) {
      this.logger.warn('No code received in Facebook callback');
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=no_code_received`);
    }

    try {
      this.logger.log(`Procesando callback de Facebook para workspace: ${workspaceId}`);

      // A. Intercambiar código por token de usuario
      const userToken = await this.facebookAuthService.exchangeCodeForToken(code);

      // B. Obtener token de larga duración
      const longLivedToken = await this.facebookAuthService.getLongLivedToken(userToken);

      // C. Listar cuentas (Facebook Pages + Instagram Business)
      const allAccounts = await this.facebookAuthService.getFacebookAndInstagramAccounts(longLivedToken);
      this.logger.debug(`Cuentas encontradas: ${allAccounts.length}`);

      if (allAccounts.length === 0) {
        this.logger.warn(
          `[FB CALLBACK] No se encontraron cuentas asociadas en Facebook/Instagram: workspaceId=${workspaceId}, reason=no_accounts_found`,
        );
        return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=no_accounts_found`);
      }

      // D. Guardar todas las cuentas encontradas evitando duplicados (Upsert interno)
      const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, include: { owner: true } });
      const organizationId = workspace?.owner?.organizationId || '';
      const seenCallbackKeys = new Set<string>();
      for (const account of allAccounts) {
        const accountKey = `${account.provider}:${account.providerAccountId}`;
        if (seenCallbackKeys.has(accountKey)) {
          continue;
        }
        seenCallbackKeys.add(accountKey);
        this.logger.log(`[FB CALLBACK] Guardando/Actualizando cuenta: workspaceId=${workspaceId}, organizationId=${organizationId}, provider=${account.provider}, providerAccountId=${account.providerAccountId}, username=${account.username}`);
        await this.socialAccountsService.create({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          username: account.username,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          accessToken: account.accessToken,
        }, workspaceId, organizationId);
      }

      // E. Redirigir de vuelta al Frontend
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?success_connection=true`);
    } catch (error: any) {
      const safeErrorMsg = (error?.message || 'Unknown error').replace(
        /access_token=[^&\s]+/gi,
        'access_token=[REDACTED]',
      );
      this.logger.error(
        `[FB CALLBACK] Error en callback de Facebook: workspaceId=${workspaceId}, reason=callback_exception, message="${safeErrorMsg}"`,
      );
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=facebook_connection_failed`);
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
    return res.redirect(url);
  }

  // 4. Callback de LinkedIn
  @Get('callback/linkedin')
  async linkedinCallback(@Req() req, @Res() res: Response) {
    const { code, state: workspaceId } = req.query;

    this.logger.debug('LinkedIn callback hit');

    if (!code) {
      this.logger.error('No se recibió código de LinkedIn');
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab.me';
      return res.redirect(`${frontendUrl}/?error=no_code_received`);
    }

    if (!workspaceId || workspaceId === 'undefined') {
      this.logger.error('No se recibió workspaceId en el state');
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab.me';
      return res.redirect(`${frontendUrl}/?error=invalid_workspace`);
    }

    try {
      // 1. Intercambio de code por token
      const accessToken = await this.linkedinAuthService.exchangeCodeForToken(code);

      // 2. Obtener información del usuario
      const userData = await this.linkedinAuthService.getUserProfile(accessToken);
      this.logger.debug('Perfil de LinkedIn obtenido', { id: userData?.id });

      // 3. Guardar en Base de Datos (Upsert)
      await this.socialAccountsService.create({
        provider: 'LINKEDIN',
        providerAccountId: userData.id,
        username: userData.email,
        displayName: userData.name,
        avatarUrl: userData.picture,
        accessToken: accessToken,
      }, workspaceId as string, (await this.prisma.workspace.findUnique({ where: { id: workspaceId as string }, include: { owner: true } }))?.owner?.organizationId || '');

      // 4. Redirigir al Frontend con éxito
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.autopostlab.me';
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?success=true&provider=linkedin`);
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

      const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, include: { owner: true } });
      const organizationId = workspace?.owner?.organizationId || '';
      const results: any[] = [];
      for (const account of allAccounts) {
        const acc = await this.socialAccountsService.create({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          username: account.username,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          accessToken: account.accessToken,
        }, workspaceId, organizationId);
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
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.autopostlab.me';
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
      }, workspaceId, (await this.prisma.workspace.findUnique({ where: { id: workspaceId }, include: { owner: true } }))?.owner?.organizationId || '');

      // D. Redirigir al Frontend con éxito
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.autopostlab.me';
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?success=true&provider=tiktok`);
    } catch (error) {
      this.logger.error('Error fatal en callback de TikTok:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.autopostlab.me';
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
    const orgId = (await this.prisma.workspace.findUnique({ where: { id: workspaceId }, include: { owner: true } }))?.owner?.organizationId || '';
    const account = await this.socialAccountsService.findByWorkspaceAndProvider(
      workspaceId,
      orgId,
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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "https://autopostlab.me/api/social-auth/callback/google";

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
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || "https://autopostlab.me/api/social-auth/callback/google",
          grant_type: 'authorization_code',
        }),
      });

      const tokens: any = await tokenResponse.json();

      if (tokens.error) {
        this.logger.error(`Error intercambiando código de Google: ${tokens.error_description || tokens.error}`);
        throw new Error(tokens.error_description || tokens.error);
      }

      const { id_token } = tokens;

      // 2. Usar AuthService para realizar el login/registro silencioso y obtener JWT de Autopostlab
      const loginResult = await this.authService.loginWithGoogle(id_token);

      // 3. Redirigir al frontend con los tokens de acceso
      const redirectUrl = `https://app.autopostlab.me/dashboard?token=${loginResult.accessToken}&refreshToken=${loginResult.refreshToken}`;

      this.logger.log(`Login exitoso para ${loginResult.user.email}. Redirigiendo al dashboard...`);
      return res.redirect(redirectUrl);

    } catch (error: any) {
      this.logger.error(`Error en callback de Google: ${error?.message || 'Unknown error'}`);
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.autopostlab.me';
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  }
}
