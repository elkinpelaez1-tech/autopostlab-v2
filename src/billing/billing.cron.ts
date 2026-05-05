import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionExpirations() {
    this.logger.log('Iniciando proceso de verificación de expiración de planes...');

    const now = new Date();

    try {
      // Buscar todas las organizaciones PRO cuyo planExpiresAt sea anterior a hoy
      const expiredOrgs = await this.prisma.organization.findMany({
        where: {
          plan: 'PRO',
          planExpiresAt: {
            lt: now
          }
        }
      });

      if (expiredOrgs.length === 0) {
        this.logger.log('No se encontraron planes expirados hoy.');
        return;
      }

      this.logger.log(`Se encontraron ${expiredOrgs.length} organizaciones con plan expirado.`);

      for (const org of expiredOrgs) {
        // Actualizar a FREE y setear planExpiresAt a null
        await this.prisma.organization.update({
          where: { id: org.id },
          data: {
            plan: 'FREE',
            planExpiresAt: null,
            // hadPro se mantiene en true
          }
        });

        this.logger.log(`Organización ${org.id} (${org.name}) bajada a FREE por expiración de suscripción.`);
      }

      this.logger.log('Proceso de verificación de expiraciones completado.');
    } catch (error) {
      this.logger.error('Error al procesar expiraciones de planes', error);
    }
  }
}
