import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSocialAccountDto } from './dto/create-social-account.dto';
import { UpdateSocialAccountDto } from './dto/update-social-account.dto';
import { SocialProvider } from '@prisma/client';

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Create or upsert social account
  async create(dto: CreateSocialAccountDto, workspaceId: string, organizationId: string) {
    try {
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

      const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (organization && organization.plan !== 'AGENCY') {
        const accountsCount = await this.prisma.socialAccount.count({ where: { organizationId } });
        const limit = organization.plan === 'FREE' ? 100 : organization.plan === 'PRO' ? 100 : 0;
        if (accountsCount >= limit) {
          throw new ForbiddenException('Has alcanzado el límite de cuentas sociales de tu plan');
        }
      }

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
      this.logger.log(`✅ [DB] Registro creado: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error('❌ [DB] Error en upsert de cuenta:', error);
      throw error;
    }
  }

  async findAll(workspaceId: string, organizationId: string) {
    return this.prisma.socialAccount.findMany({
      where: { workspaceId, organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, workspaceId: string, organizationId: string) {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, workspaceId, organizationId },
    });
    if (!account) throw new NotFoundException('Cuenta social no encontrada');
    return account;
  }

  async update(id: string, dto: UpdateSocialAccountDto, workspaceId: string, organizationId: string) {
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

  async remove(id: string, workspaceId: string, organizationId: string) {
    await this.findOne(id, workspaceId, organizationId);
    const deletedSchedules = await this.prisma.scheduledPost.deleteMany({ where: { socialAccountId: id } });
    console.log(`🗑️ [DB] Se eliminaron ${deletedSchedules.count} posts programados asociados.`);
    await this.prisma.post.updateMany({ where: { socialAccountId: id }, data: { socialAccountId: null } });
    return this.prisma.socialAccount.delete({ where: { id } });
  }

  async findByWorkspaceAndProvider(workspaceId: string, organizationId: string, provider: SocialProvider) {
    return this.prisma.socialAccount.findFirst({ where: { workspaceId, organizationId, provider } });
  }

  // Detect and link Instagram Business accounts
  async detectAndLinkInstagramAccounts(workspaceId: string, organizationId: string) {
    this.logger.log(`🔍 [IG DETECTION] Buscando cuentas Instagram vinculadas para workspace ${workspaceId}`);
    const facebookPages = await this.prisma.socialAccount.findMany({
      where: { workspaceId, organizationId, provider: 'FACEBOOK', status: 'ACTIVE' },
    });
    const linkedInstagramAccounts: any[] = [];
    for (const page of facebookPages) {
      try {
        this.logger.log(`🔍 [IG DETECTION] Escaneando página FB: ${page.displayName} (${page.providerAccountId})`);
        const fields = 'id,name,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}';
        const url = `https://graph.facebook.com/v22.0/${page.providerAccountId}?fields=${fields}&access_token=${page.accessToken}`;
        const response = await fetch(url);
        const data: any = await response.json();
        console.log('📄 Graph API response:', JSON.stringify(data, null, 2));
        console.log('📦 instagram_business_account:', JSON.stringify(data.instagram_business_account, null, 2));
        console.log('📦 connected_instagram_account:', JSON.stringify(data.connected_instagram_account, null, 2));
        if (data.error) {
          this.logger.error(`❌ [IG DETECTION] Error de Graph API en página ${page.displayName}:`, JSON.stringify(data.error, null, 2));
          continue;
        }
        const ig = data.instagram_business_account || data.connected_instagram_account;
        console.log('🔎 Condition ig exists:', !!ig);
        if (ig) {
          const type = data.instagram_business_account ? 'instagram_business_account' : 'connected_instagram_account';
          this.logger.log(`📸 [IG DETECTION] Instagram detectado via ${type}: ${ig.username || ig.id}`);
          console.log('💾 ProviderAccountId to save:', ig.id);
          const savedIg = await this.create(
            {
              provider: 'INSTAGRAM',
              providerAccountId: ig.id,
              username: ig.username || `ig_${ig.id}`,
              displayName: ig.name || ig.username || `${page.displayName} (Instagram)`,
              avatarUrl: ig.profile_picture_url || null,
              accessToken: page.accessToken,
            },
            workspaceId,
            organizationId,
          );
          console.log('✅ Upsert result:', JSON.stringify(savedIg, null, 2));
          linkedInstagramAccounts.push(savedIg);
        } else {
          this.logger.log(`⚠️ [IG DETECTION] La página FB ${page.displayName} no tiene cuenta de Instagram vinculada.`);
        }
      } catch (error) {
        this.logger.error(`❌ [IG DETECTION] Error procesando página FB ${page.displayName}:`, error);
      }
    }
    console.log('📊 linkedInstagramAccounts length before return:', linkedInstagramAccounts.length);
    const returnObj = {
      message: `Búsqueda completada. Se vincularon ${linkedInstagramAccounts.length} cuentas de Instagram.`,
      accounts: linkedInstagramAccounts,
    };
    console.log('🔚 Return object from detectAndLinkInstagramAccounts:', JSON.stringify(returnObj, null, 2));
    return returnObj;
  }
}
