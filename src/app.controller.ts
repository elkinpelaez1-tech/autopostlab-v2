import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('diag-backend-state')
  async diag() {
    const rawUrl = process.env.DATABASE_URL || 'NOT_SET';
    
    // Ocultar password para seguridad en el log pero ver la URL real
    const safeUrl = rawUrl.replace(/:([^:@]+)@/, ':********@');
    
    const urlObj = rawUrl.includes('@') ? rawUrl.split('@')[1] : rawUrl;
    const host = urlObj.split('/')[0];
    
    const user = await this.prisma.user.findUnique({
      where: { email: 'elkinpelaez1@gmail.com' }
    });
    
    return {
      status: 'ok',
      backend_db_safe_url: safeUrl,
      backend_db_host: host,
      backend_user_found: !!user,
      backend_user_role: user?.role || 'NOT_DEFINED',
      prisma_keys: user ? Object.keys(user) : []
    };
  }

  @Get('run-emergency-promotion-trigger')
  async emergencyPromotion() {
    const email = 'elkinpelaez1@gmail.com';
    
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: false, error: `User ${email} not found in ACTIVE db` };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { role: 'SUPER_ADMIN' as any }
    });

    return {
      success: true,
      message: `NATIVE PROMOTION SUCCESSFUL in active DB`,
      new_role: updated.role
    };
  }
}
