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
}
