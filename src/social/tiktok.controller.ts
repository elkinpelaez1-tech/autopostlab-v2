import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { TikTokAuthService } from './tiktok-auth.service';
import { SocialAccountsService } from './social-accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Response } from 'express';

@Controller('tiktok')
export class TikTokController {
  private readonly logger = new Logger(TikTokController.name);

  constructor(
    private readonly tiktokAuthService: TikTokAuthService,
    private readonly socialAccountsService: SocialAccountsService,
    private readonly prisma: PrismaService,
  ) { }

  @Get('auth')
  async tiktokAuth(@Query('workspaceId') workspaceId: string, @Res() res: Response) {
    this.logger.log(`Iniciando auth de TikTok para workspace: ${workspaceId}`);
    if (!workspaceId) {
      return res.status(400).json({ error: 'WorkspaceId es requerido' });
    }

    // El servicio usa param: state=workspaceId para poder recuperarlo en el callback
    const authUrl = this.tiktokAuthService.getAuthorizationUrl(workspaceId);
    return res.redirect(authUrl);
  }

  @Get('callback')
  async tiktokCallback(
    @Query('code') code: string,
    @Query('state') workspaceId: string, // Recuperamos el workspaceId del state
    @Query('error') errorDesc: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Procesando callback de TikTok para workspace: ${workspaceId}`);

    if (errorDesc || !code) {
      this.logger.error(`Error en callback de TikTok: ${errorDesc}`);
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab.me';
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=tiktok_auth_failed`);
    }

    try {
      // 1. Intercambiar código por tokens
      const tokenData = await this.tiktokAuthService.exchangeCodeForToken(code);

      console.log("ACCESS TOKEN:", tokenData.accessToken);

      this.logger.log(`[DEBUG] Token Data Recibido: ${JSON.stringify({
        haAccessToken: !!tokenData.accessToken,
        accessTokenPrefix: tokenData.accessToken?.substring(0, 5),
        openId: tokenData.openId,
        expiresIn: tokenData.expiresIn
      })}`);

      // 2. Obtener información del perfil (TEMPORALMENTE DESHABILITADO SEGÚN INSTRUCCIONES)
      // const userData = await this.tiktokAuthService.getUserProfile(tokenData.accessToken);

      const fallbackId = `tiktok_${Date.now()}`;
      const safeOpenId = tokenData.openId || fallbackId;

      // 3. Guardar en Base de Datos (Upsert) asociándolo al workspace
      await this.socialAccountsService.create({
        provider: 'TIKTOK',
        providerAccountId: safeOpenId, // Usamos el openId que viene en la respuesta del token
        username: `TikTok_${safeOpenId.substring(0, 8)}`, // Fallback
        displayName: 'Cuenta TikTok', // Fallback
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        accessTokenExpires: tokenData.expiresAt,
      }, workspaceId, (await this.prisma.workspace.findUnique({ where: { id: workspaceId }, include: { owner: true } }))?.owner?.organizationId || '');

      // 4. Redirigir al Frontend con éxito
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab.me';
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?success=true&provider=tiktok`);
    } catch (error) {
      this.logger.error('Error fatal en callback de TikTok:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab.me';
      return res.redirect(`${frontendUrl}/dashboard/social-accounts?error=${encodeURIComponent(error.message)}`);
    }
  }
}
