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
    let migrationResults = [];

    try {
      // 1. Asegurar Estructura SQL en la base de datos real activa
      console.log('>>> APLICANDO HOTFIX SQL EN DB REAL...');
      
      try { await this.prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'`); migrationResults.push("ALTER ROLE OK"); } catch(e: any) { migrationResults.push("ALTER ROLE SKIP/FAIL: " + e.message); }
      
      try { await this.prisma.$executeRawUnsafe(`ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN DEFAULT false`); migrationResults.push("COL ORG OK"); } catch(e: any) { migrationResults.push("COL ORG SKIP/FAIL: " + e.message); }
      
      try { await this.prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN DEFAULT false`); migrationResults.push("COL USER OK"); } catch(e: any) { migrationResults.push("COL USER SKIP/FAIL: " + e.message); }

      // 2. Buscar usuario
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        return { success: false, error: `User ${email} not found in ACTIVE db`, sql: migrationResults };
      }

      // 3. Actualizar
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'SUPER_ADMIN' as any }
      });

      return {
        success: true,
        message: `NATIVE PROMOTION SUCCESSFUL`,
        new_role: updated.role,
        found_user_id: user.id,
        sql_status: migrationResults
      };
    } catch (err: any) {
      return { success: false, fatal: err.message, sql: migrationResults };
    }
  }
}
