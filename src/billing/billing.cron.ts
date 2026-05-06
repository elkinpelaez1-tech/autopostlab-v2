import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService
  ) {}

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

        // Crear notificación de EXPIRED si no existe o limpiar la de EXPIRING_SOON
        const existingNotif = await this.prisma.billingNotification.findFirst({
          where: { organizationId: org.id, type: 'EXPIRED' }
        });

        if (!existingNotif) {
          const newNotif = await this.prisma.billingNotification.create({
            data: {
              type: 'EXPIRED',
              message: 'Tu plan PRO ha expirado. Renueva para seguir disfrutando de todas las funciones.',
              organizationId: org.id,
              emailSent: false,
            }
          });

          // Enviar email a los ADMINS
          const admins = await this.prisma.user.findMany({
            where: { organizationId: org.id, role: 'ADMIN' }
          });

          for (const admin of admins) {
            await this.mailService.sendExpiredEmail(admin.email, org.name);
          }

          // Marcar como enviado
          await this.prisma.billingNotification.update({
            where: { id: newNotif.id },
            data: { emailSent: true }
          });
        }

        this.logger.log(`Organización ${org.id} (${org.name}) bajada a FREE por expiración de suscripción.`);
      }

      this.logger.log('Proceso de verificación de expiraciones completado.');
    } catch (error) {
      this.logger.error('Error al procesar expiraciones de planes', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiringSoonNotifications() {
    this.logger.log('Iniciando proceso de notificación de vencimientos próximos...');
    const now = new Date();
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(now.getDate() + 5);

    try {
      const expiringOrgs = await this.prisma.organization.findMany({
        where: {
          plan: 'PRO',
          planExpiresAt: {
            lte: fiveDaysFromNow,
            gte: now,
          }
        }
      });

      if (expiringOrgs.length === 0) {
        this.logger.log('No se encontraron planes próximos a expirar hoy.');
        return;
      }

      for (const org of expiringOrgs) {
        const existingNotif = await this.prisma.billingNotification.findFirst({
          where: { organizationId: org.id, type: 'EXPIRING_SOON' }
        });

        if (!existingNotif) {
          const newNotif = await this.prisma.billingNotification.create({
            data: {
              type: 'EXPIRING_SOON',
              message: 'Tu suscripción PRO está próxima a expirar. ¡Renueva ahora para no perder acceso!',
              organizationId: org.id,
              emailSent: false,
            }
          });
          
          // Enviar email a los ADMINS
          const admins = await this.prisma.user.findMany({
            where: { organizationId: org.id, role: 'ADMIN' }
          });

          for (const admin of admins) {
            await this.mailService.sendExpiringSoonEmail(admin.email, org.name);
          }

          // Marcar como enviado
          await this.prisma.billingNotification.update({
            where: { id: newNotif.id },
            data: { emailSent: true }
          });

          this.logger.log(`Notificación EXPIRING_SOON creada y enviada para la organización ${org.id}`);
        }
      }
      this.logger.log('Proceso de notificación de vencimientos completado.');
    } catch (error) {
      this.logger.error('Error al procesar notificaciones de vencimientos', error);
    }
  }
}
