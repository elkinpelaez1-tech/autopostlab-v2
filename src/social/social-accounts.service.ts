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
        this.logger.log(
          `🔄 [DB] Actualizando cuenta existente: workspaceId=${workspaceId}, organizationId=${organizationId}, provider=${dto.provider}, providerAccountId=${dto.providerAccountId}, recordId=${existing.id}`,
        );
        return await this.prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            organizationId,
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
    this.logger.log(
      `🔍 [IG DETECTION] Buscando cuentas Instagram vinculadas: workspaceId=${workspaceId}, organizationId=${organizationId}`,
    );
    const facebookPages = await this.prisma.socialAccount.findMany({
      where: { workspaceId, organizationId, provider: 'FACEBOOK', status: 'ACTIVE' },
    });
    this.logger.log(
      `[IG DETECTION] workspaceId=${workspaceId}, organizationId=${organizationId}: hasActiveFacebookPages=${facebookPages.length > 0}, pagesToQuery=${facebookPages.length}`,
    );

    if (facebookPages.length === 0) {
      this.logger.warn(
        `⚠️ [IG DETECTION] workspaceId=${workspaceId}, organizationId=${organizationId}: result=no_active_facebook_pages, reason=no_active_facebook_pages_in_workspace`,
      );
      return {
        message: 'Primero debes conectar una página de Facebook activa antes de vincular Instagram.',
        created: 0,
        reason: 'NO_ACTIVE_FACEBOOK_PAGES',
        accounts: [],
        errors: [],
      };
    }

    const linkedInstagramAccounts: any[] = [];
    const seenIgIds = new Set<string>();
    const pageErrors: Array<{
      pageId: string;
      pageName: string | null;
      code: string | number;
      subcode: string | number;
      reason: string;
      message: string;
    }> = [];
    let permissionIssuesCount = 0;

    for (const page of facebookPages) {
      try {
        this.logger.log(
          `🔍 [IG DETECTION] Escaneando página FB: workspaceId=${workspaceId}, organizationId=${organizationId}, pageId=${page.providerAccountId}, pageName="${page.displayName}"`,
        );
        const fields =
          'id,name,tasks,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}';
        const url = `https://graph.facebook.com/v22.0/${page.providerAccountId}?fields=${fields}&access_token=${page.accessToken}`;
        const response = await fetch(url);
        const data: any = await response.json();

        if (data?.error) {
          const errCode = data.error.code ?? 'N/A';
          const errSubcode = data.error.error_subcode ?? 'N/A';
          const errMsg = data.error.message ?? 'Unknown Meta error';
          const isPermissionError =
            [10, 25, 190, 200].includes(Number(errCode)) || Number(errSubcode) === 2207050;
          const errorReason = isPermissionError
            ? 'insufficient_permissions_or_restricted_access'
            : 'graph_api_error';
          if (isPermissionError) {
            permissionIssuesCount += 1;
          }
          pageErrors.push({
            pageId: page.providerAccountId,
            pageName: page.displayName,
            code: errCode,
            subcode: errSubcode,
            reason: errorReason,
            message: errMsg,
          });
          this.logger.error(
            `❌ [IG DETECTION] Error de Graph API en página ${page.displayName} (${page.providerAccountId}): workspaceId=${workspaceId}, organizationId=${organizationId}, result=error, code=${errCode}, subcode=${errSubcode}, reason=${errorReason}, message="${errMsg}"`,
          );
          continue;
        }

        const pageTasks: string[] = Array.isArray(data?.tasks) ? data.tasks : [];
        const hasRequiredPageTasks =
          pageTasks.length === 0 ||
          pageTasks.includes('MANAGE') ||
          pageTasks.includes('CREATE_CONTENT') ||
          pageTasks.includes('MODERATE') ||
          pageTasks.includes('ADVERTISE');

        const hasBusinessIg = Boolean(data?.instagram_business_account?.id);
        const hasConnectedIg = Boolean(data?.connected_instagram_account?.id);
        const igSource = hasBusinessIg
          ? 'instagram_business_account'
          : hasConnectedIg
            ? 'connected_instagram_account'
            : 'none';

        this.logger.log(
          `[IG DETECTION] Página FB ${page.displayName} (${page.providerAccountId}): workspaceId=${workspaceId}, organizationId=${organizationId}, tasks=${JSON.stringify(pageTasks)}, result=${igSource}, hasBusinessIg=${hasBusinessIg}, hasConnectedIg=${hasConnectedIg}`,
        );

        const ig = hasBusinessIg
          ? data.instagram_business_account
          : hasConnectedIg
            ? data.connected_instagram_account
            : null;

        if (ig?.id) {
          if (seenIgIds.has(ig.id)) {
            this.logger.log(
              `[IG DETECTION] Cuenta de Instagram duplicada omitida en el mismo escaneo: workspaceId=${workspaceId}, organizationId=${organizationId}, pageId=${page.providerAccountId}, igId=${ig.id}, reason=duplicate_in_batch`,
            );
            continue;
          }
          seenIgIds.add(ig.id);

          this.logger.log(
            `📸 [IG DETECTION] Instagram detectado via ${igSource}: igId=${ig.id}, username=${ig.username || ig.id}`,
          );
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
          this.logger.log(
            `✅ [IG DETECTION] Instagram vinculado en BD: workspaceId=${workspaceId}, organizationId=${organizationId}, pageId=${page.providerAccountId}, igId=${ig.id}, recordId=${savedIg.id}, reason=linked`,
          );
          linkedInstagramAccounts.push(savedIg);
        } else {
          if (!hasRequiredPageTasks) {
            permissionIssuesCount += 1;
            pageErrors.push({
              pageId: page.providerAccountId,
              pageName: page.displayName,
              code: 'TASKS_RESTRICTED',
              subcode: 'N/A',
              reason: 'insufficient_page_tasks',
              message: `Permisos de página insuficientes: tasks=${JSON.stringify(pageTasks)}`,
            });
          }
          const noIgReason = !hasRequiredPageTasks
            ? 'insufficient_page_tasks'
            : 'no_instagram_linked_or_not_authorized';
          this.logger.warn(
            `⚠️ [IG DETECTION] La página FB ${page.displayName} (${page.providerAccountId}) no devolvió cuenta de Instagram: workspaceId=${workspaceId}, organizationId=${organizationId}, tasks=${JSON.stringify(pageTasks)}, result=none, reason=${noIgReason}`,
          );
        }
      } catch (error: any) {
        pageErrors.push({
          pageId: page.providerAccountId,
          pageName: page.displayName,
          code: 'EXCEPTION',
          subcode: 'N/A',
          reason: 'unexpected_exception',
          message: error?.message || 'Unknown error',
        });
        this.logger.error(
          `❌ [IG DETECTION] Error procesando página FB ${page.displayName} (${page.providerAccountId}): workspaceId=${workspaceId}, organizationId=${organizationId}, reason=unexpected_exception, message="${error?.message || 'Unknown error'}"`,
        );
      }
    }

    this.logger.log(
      `📊 [IG DETECTION] Finalizado: workspaceId=${workspaceId}, organizationId=${organizationId}, pagesQueried=${facebookPages.length}, instagramLinked=${linkedInstagramAccounts.length}, errorsCount=${pageErrors.length}`,
    );

    if (linkedInstagramAccounts.length > 0) {
      return {
        message: `Se vincularon ${linkedInstagramAccounts.length} cuentas de Instagram`,
        created: linkedInstagramAccounts.length,
        reason: 'LINKED',
        accounts: linkedInstagramAccounts,
        errors: pageErrors,
      };
    }

    if (permissionIssuesCount > 0 || pageErrors.length > 0) {
      return {
        message:
          'No se pudo vincular Instagram porque faltan permisos sobre la página de Facebook o la cuenta de Instagram en Meta. Revisa tus permisos en Meta Business Suite y vuelve a conectar Facebook.',
        created: 0,
        reason: 'INSUFFICIENT_PERMISSIONS',
        accounts: [],
        errors: pageErrors,
      };
    }

    return {
      message:
        'No se encontró una cuenta profesional de Instagram vinculada a tu página de Facebook. Verifica que tu cuenta de Instagram sea Profesional o Creador, esté conectada a la página y haya sido autorizada en Meta.',
      created: 0,
      reason: 'NO_INSTAGRAM_FOUND',
      accounts: [],
      errors: [],
    };
  }
}
