import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSocialAccountDto } from './dto/create-social-account.dto';
import { UpdateSocialAccountDto } from './dto/update-social-account.dto';
import { SocialProvider } from '@prisma/client';

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------
  // 📌 Crear o Actualizar cuenta social (Upsert)
  // ----------------------------------------------------------
  async create(dto: CreateSocialAccountDto, workspaceId: string, organizationId: string) {
    try {
      // 1. Buscar si ya existe la combinación provider + providerAccountId en este workspace/org
      const existing = await this.prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          organizationId,
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
        },
      });

      if (existing) {
        this.logger.log(`🔄 [DB] Actualizando cuenta existente: ${dto.provider} - ${dto.providerAccountId}`);
        return await this.prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            username: dto.username ?? undefined,
            displayName: dto.displayName ?? undefined,
            avatarUrl: dto.avatarUrl ?? undefined,
            accessToken: dto.accessToken,
            refreshToken: dto.refreshToken ?? undefined,
            accessTokenExpires: dto.accessTokenExpires ?? undefined,
            status: 'ACTIVE',
          },
        });
      }

      // PLAN ENFORCEMENT: Verificar límites de cuentas sociales
      const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (organization && organization.plan !== 'AGENCY') {
        const accountsCount = await this.prisma.socialAccount.count({ where: { organizationId } });
        // 🚀 LÍMITE AUMENTADO TEMPORALMENTE PARA DESARROLLO/TESTING (FREE: 100, PRO: 100)
        const limit = organization.plan === 'FREE' ? 100 : (organization.plan === 'PRO' ? 100 : 0);
        if (accountsCount >= limit) {
          throw new ForbiddenException('Has alcanzado el límite de cuentas sociales de tu plan');
        }
      }

      // 2. Si no existe, crear nueva
      const result = await this.prisma.socialAccount.create({
        data: {
          workspaceId,
          organizationId,
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
          username: dto.username ?? null,
          displayName: dto.displayName ?? null,
          avatarUrl: dto.avatarUrl ?? null,
          accessToken: dto.accessToken,
          refreshToken: dto.refreshToken ?? null,
          accessTokenExpires: dto.accessTokenExpires ?? null,
          status: dto.status ?? 'ACTIVE',
        },
      });
      this.logger.log(`✅ [DB] Registro creado exitosamente: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error('❌ [DB] Error en upsert de cuenta:', error);
      throw error;
    }
  }

  // ----------------------------------------------------------
  // 📌 Obtener todas las cuentas del usuario
  // ----------------------------------------------------------
  async findAll(workspaceId: string, organizationId: string) {
    return this.prisma.socialAccount.findMany({
      where: { workspaceId, organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ----------------------------------------------------------
  // 📌 Obtener una cuenta social
  // ----------------------------------------------------------
  async findOne(id: string, workspaceId: string, organizationId: string) {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, workspaceId, organizationId },
    });

    if (!account) throw new NotFoundException('Cuenta social no encontrada');

    return account;
  }

  // ----------------------------------------------------------
  // 📌 Actualizar cuenta social
  // ----------------------------------------------------------
  async update(id: string, dto: UpdateSocialAccountDto, workspaceId: string, organizationId: string) {
    // Verificar propiedad
    await this.findOne(id, workspaceId, organizationId);

    return this.prisma.socialAccount.update({
      where: { id },
      data: {
        provider: dto.provider ?? undefined,
        providerAccountId: dto.providerAccountId ?? undefined,
        username: dto.username ?? undefined,
        displayName: dto.displayName ?? undefined,
        avatarUrl: dto.avatarUrl ?? undefined,

        accessToken: dto.accessToken ?? undefined,
        refreshToken: dto.refreshToken ?? undefined,
        accessTokenExpires: dto.accessTokenExpires ?? undefined,

        status: dto.status ?? undefined,
      },
    });
  }

  // ----------------------------------------------------------
  // 📌 Eliminar cuenta social
  // ----------------------------------------------------------
  async remove(id: string, workspaceId: string, organizationId: string) {
    // 1. Verificar propiedad y existencia
    await this.findOne(id, workspaceId, organizationId);

    // 2. Limpieza en cascada manual (ScheduledPost)
    // Nota: El schema actual no tiene Cascade para ScheduledPost -> SocialAccount
    const deletedSchedules = await this.prisma.scheduledPost.deleteMany({
      where: { socialAccountId: id }
    });
    console.log(`🗑️ [DB] Se eliminaron ${deletedSchedules.count} posts programados asociados.`);

    // 3. Desvincular de Posts (opcional, pero lo seteamos a null si existe la relación)
    await this.prisma.post.updateMany({
      where: { socialAccountId: id },
      data: { socialAccountId: null }
    });

    // 4. Eliminar la cuenta
    return this.prisma.socialAccount.delete({
      where: { id },
    });
  }

  // ----------------------------------------------------------
  // 📌 Obtener una cuenta por plataforma y workspace
  // ----------------------------------------------------------
  async findByWorkspaceAndProvider(workspaceId: string, organizationId: string, provider: SocialProvider) {
    return this.prisma.socialAccount.findFirst({
      where: { workspaceId, organizationId, provider },
    });
  }

  // ----------------------------------------------------------
  // 📌 Detectar y vincular cuentas de Instagram Business usando Páginas de Facebook conectadas
  // ----------------------------------------------------------
  async detectAndLinkInstagramAccounts(workspaceId: string, organizationId: string) {
    this.logger.log(`🔍 [IG DETECTION] Buscando cuentas Instagram vinculadas para el workspace: ${workspaceId}`);
    
    // 1. Obtener todas las páginas de Facebook conectadas en este workspace
    const facebookPages = await this.prisma.socialAccount.findMany({
      where: {
        workspaceId,
        organizationId,
        provider: 'FACEBOOK',
        status: 'ACTIVE',
      },
    });

    const linkedInstagramAccounts: any[] = [];

    for (const page of facebookPages) {
      try {
        this.logger.log(`🔍 [IG DETECTION] Escaneando página FB: ${page.displayName} (${page.providerAccountId})`);
        
        // 2. Consultar directamente /{page-id}?fields=id,name,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url} con su Page Access Token en v19.0
        const fields = 'id,name,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}';
        const url = `https://graph.facebook.com/v19.0/${page.providerAccountId}?fields=${fields}&access_token=${page.accessToken}`;
        const response = await fetch(url);
        const data = await response.json();

        console.log('\n🔴🔴🔴 [DEBUG CONTROLADO - START] 🔴🔴🔴');
        console.log(`📌 PAGE ID: ${page.providerAccountId}`);
        console.log(`📌 PAGE NAME: ${page.displayName}`);
        console.log(`📡 VERSION API: v19.0`);
        console.log(`🏷️ TOKEN TYPE: Page Access Token`);
        console.log(`📋 FIELDS SOLICITADOS: ${fields}`);
        console.log(`🔗 URL FINAL ENVIADA: https://graph.facebook.com/v19.0/${page.providerAccountId}?fields=${fields}&access_token=${page.accessToken ? page.accessToken.substring(0, 15) : 'NULO'}...`);
        console.log(`🔑 TOKEN COMPLETO DE PÁGINA (primeros 25 car.): ${page.accessToken ? page.accessToken.substring(0, 25) : 'NULO'}...`);
        console.log(`📄 RESPUESTA COMPLETA DE META:`, JSON.stringify(data, null, 2));
        console.log('🔴🔴🔴 [DEBUG CONTROLADO - END] 🔴🔴🔴\n');

        // Guardar respuesta en archivo scratch para inspección del agente interno
        try {
          const fs = require('fs');
          const path = require('path');
          const scratchDir = path.join(process.cwd(), 'scratch');
          if (!fs.existsSync(scratchDir)) {
            fs.mkdirSync(scratchDir, { recursive: true });
          }
          fs.writeFileSync(
            path.join(scratchDir, 'latest_ig_response.json'),
            JSON.stringify({ page: page.displayName, pageId: page.providerAccountId, fields, tokenType: 'Page Access Token', response: data }, null, 2)
          );
        } catch (e) {
          console.error('❌ Error guardando archivo de depuración scratch:', e);
        }

        if (data.error) {
          this.logger.error(`❌ [IG DETECTION] Error de Graph API en página ${page.displayName}:`, JSON.stringify(data.error, null, 2));
          continue;
        }

        // 3. Si existe instagram_business_account o connected_instagram_account, vincularla
        const ig = data.instagram_business_account || data.connected_instagram_account;
        if (ig) {
          const type = data.instagram_business_account ? 'instagram_business_account' : 'connected_instagram_account';
          this.logger.log(`📸 [IG DETECTION] ¡Instagram detectado mediante ${type}!: ${ig.username || ig.id}`);

          // 4. Realizar upsert en la base de datos para la cuenta de Instagram
          console.log('🟢 [IG DETECTION] Intentando guardar IG:', JSON.stringify({ id: ig.id, username: ig.username, workspaceId, organizationId }));
          const savedIg = await this.create({
            provider: 'INSTAGRAM',
            providerAccountId: ig.id,
            username: ig.username || `ig_${ig.id}`,
            displayName: ig.name || ig.username || `${page.displayName} (Instagram)`,
            avatarUrl: ig.profile_picture_url || null,
            accessToken: page.accessToken, // 🔥 Reutiliza el token de acceso de la página de Facebook
          }, workspaceId, organizationId);
          console.log('🟢 [IG DETECTION] Guardado exitoso:', JSON.stringify(savedIg));

          linkedInstagramAccounts.push(savedIg);
        } else {
          this.logger.log(`⚠️ [IG DETECTION] La página FB ${page.displayName} no tiene cuenta de Instagram vinculada (probados instagram_business_account y connected_instagram_account).`);
        }
      } catch (error) {
        this.logger.error(`❌ [IG DETECTION] Error procesando página FB ${page.displayName}:`, error);
      }
    }

    return {
      message: `Búsqueda completada. Se vincularon ${linkedInstagramAccounts.length} cuentas de Instagram.`,
      accounts: linkedInstagramAccounts,
    };
  }
}
