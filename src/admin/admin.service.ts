import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // 📊 1. Métricas Globales del Sistema
  async getGlobalStats() {
    const [totalOrganizations, totalUsers, totalPosts, totalSocialAccounts] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.post.count(),
      this.prisma.socialAccount.count(),
    ]);

    return {
      summary: {
        totalOrganizations,
        totalUsers,
        totalPosts,
        totalSocialAccounts,
      },
      health: 'OPERATIONAL',
      timestamp: new Date(),
    };
  }

  // 🏢 2. Listar todas las Organizaciones/Empresas con sus métricas
  async getCompanies() {
    this.logger.log('SuperAdmin fetching company list');
    
    const orgs = await this.prisma.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            posts: true,
            socialAccounts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orgs.map(org => ({
      id: org.id,
      name: org.name,
      plan: org.plan,
      isSuspended: org.isSuspended,
      planExpiresAt: org.planExpiresAt,
      createdAt: org.createdAt,
      stats: {
        usersCount: org._count.users,
        postsCount: org._count.posts,
        socialAccountsCount: org._count.socialAccounts,
      },
    }));
  }

  // 👥 3. Listar Usuarios del Sistema
  async getUsers() {
    this.logger.log('SuperAdmin fetching user listing');

    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
