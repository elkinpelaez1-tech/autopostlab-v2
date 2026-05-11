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
    const urlObj = rawUrl.includes('@') ? rawUrl.split('@')[1] : rawUrl;
    const host = urlObj.split('/')[0];
    
    const user = await this.prisma.user.findUnique({
      where: { email: 'elkinpelaez1@gmail.com' }
    });
    
    return {
      status: 'ok',
      backend_db_host: host,
      backend_user_found: !!user,
      backend_user_role: user?.role || 'NOT_DEFINED',
      prisma_keys: user ? Object.keys(user) : []
    };
  }
}
