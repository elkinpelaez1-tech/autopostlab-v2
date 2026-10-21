import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly PRO_PRICE_CENTS = 4500000; // 45,000 COP

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService
  ) {}

  async createCheckout(organizationId: string, plan: string) {
    if (plan !== 'PRO') {
      throw new BadRequestException('Solo se soporta el plan PRO por ahora');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!org) throw new BadRequestException('Organización no encontrada');
    if (org.plan === 'PRO') throw new BadRequestException('Ya cuentas con el plan PRO');
    if (org.plan === 'AGENCY') throw new BadRequestException('Ya cuentas con el plan AGENCY');

    // Generar referencia única
    const reference = `UPG-PRO-${organizationId}-${Date.now()}`;
    const currency = 'COP';
    const amountInCents = this.PRO_PRICE_CENTS;

    const wompiEnv = process.env.WOMPI_ENV || 'sandbox';
    const publicKey = process.env.WOMPI_PUBLIC_KEY || 'pub_test_wompi';
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || '';
    
    // El redirect-url puede venir de las variables de entorno o estar hardcodeado para redirigir al dashboard
    const redirectUrl = `${process.env.FRONTEND_URL || 'https://app.autopostlab.me'}/dashboard`;

    let signature = '';
    if (integritySecret) {
      // Wompi Integrity Signature: sha256(reference + amountInCents + currency + integritySecret)
      const dataToSign = `${reference}${amountInCents}${currency}${integritySecret}`;
      const hash = crypto.createHash('sha256').update(dataToSign).digest('hex');
      signature = hash;
    }

    const baseUrl = wompiEnv === 'production' ? 'https://checkout.wompi.co/p/' : 'https://checkout.wompi.co/p/';
    // Wompi always uses checkout.wompi.co/p/ but the public key dictates environment

    let checkoutUrl = `${baseUrl}?public-key=${publicKey}&currency=${currency}&amount-in-cents=${amountInCents}&reference=${reference}&redirect-url=${encodeURIComponent(redirectUrl)}`;
    
    if (signature) {
      checkoutUrl += `&signature:integrity=${signature}`;
    }

    this.logger.log(`Generated checkout URL for org ${organizationId}`);
    
    return { checkoutUrl, reference };
  }

  async handleWebhook(body: any, signatureHeader: string) {
    this.logger.log('Recibido webhook de Wompi');

    // 1. Exigir WOMPI_EVENTS_SECRET obligatoriamente; nunca aceptar pagos sin validar firma
    const eventSecret = (process.env.WOMPI_EVENTS_SECRET || '').trim();
    if (!eventSecret) {
      this.logger.error('Webhook rechazado: WOMPI_EVENTS_SECRET no está configurado');
      throw new BadRequestException('Configuración de firma de webhook incompleta');
    }

    // 2. Validar firma según el formato oficial de eventos de Wompi:
    // SHA256(concat(body.data[prop] for prop in signature.properties) + body.timestamp + WOMPI_EVENTS_SECRET)
    const properties = body?.signature?.properties;
    const providedChecksum = String(signatureHeader || body?.signature?.checksum || '').trim().toLowerCase();
    const timestamp = body?.timestamp;
    if (
      !Array.isArray(properties) ||
      properties.length === 0 ||
      !providedChecksum ||
      timestamp === undefined ||
      timestamp === null ||
      String(timestamp).trim() === ''
    ) {
      this.logger.error('Webhook rechazado: metadatos de firma ausentes o incompletos');
      throw new BadRequestException('Firma de webhook inválida');
    }

    let dataToSign = '';
    for (const prop of properties) {
      const parts = String(prop).split('.');
      let val = body?.data;
      for (const p of parts) {
        val = val?.[p];
      }
      if (val === undefined || val === null) {
        this.logger.error(`Webhook rechazado: propiedad firmada ausente (${prop})`);
        throw new BadRequestException('Firma de webhook inválida');
      }
      dataToSign += String(val);
    }
    dataToSign += `${timestamp}${eventSecret}`;

    const expectedChecksum = crypto.createHash('sha256').update(dataToSign).digest('hex').toLowerCase();
    const providedBuf = Buffer.from(providedChecksum);
    const expectedBuf = Buffer.from(expectedChecksum);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      this.logger.error('Webhook rechazado: checksum inválido');
      throw new BadRequestException('Firma de webhook inválida');
    }

    // Usaremos validaciones de seguridad fuertes sobre los datos
    const eventType = body.event;
    if (eventType !== 'transaction.updated') {
      return { success: true, message: 'Ignorado' };
    }

    const transaction = body.data?.transaction;
    if (!transaction) throw new BadRequestException('No transaction data');

    const status = transaction.status;
    const reference = String(transaction.reference || '').trim();
    const amountInCents = transaction.amount_in_cents;
    const currency = String(transaction.currency || '').trim().toUpperCase();

    if (status !== 'APPROVED') {
      this.logger.log(`Transacción rechazada o pendiente: ${status}`);
      return { success: true, status };
    }

    // Validar moneda exacta (COP) y monto exacto ($45.000 COP = 4500000 centavos)
    if (currency !== 'COP') {
      this.logger.error(`Intento de fraude: Pago aprobado con moneda inválida (${currency})`);
      throw new BadRequestException('Moneda inválida');
    }

    if (amountInCents !== this.PRO_PRICE_CENTS) {
      this.logger.error(`Intento de fraude: Pago aprobado pero con monto inválido ${amountInCents}`);
      throw new BadRequestException('Monto inválido');
    }

    // Extraer organizationId exclusivamente del reference trazable: "UPG-PRO-{orgId}-{timestamp}"
    const parts = reference.split('-');
    const refTimestamp = Number(parts[parts.length - 1]);
    const organizationId = parts.length >= 4 ? parts.slice(2, parts.length - 1).join('-').trim() : '';
    if (
      parts.length < 4 ||
      parts[0] !== 'UPG' ||
      parts[1] !== 'PRO' ||
      !organizationId ||
      !Number.isInteger(refTimestamp) ||
      refTimestamp <= 0
    ) {
      this.logger.log(`Reference ignorada: ${reference}`);
      return { success: true, message: 'Referencia no corresponde a upgrade' };
    }
    const txIdentifier = String(transaction.id || reference).trim();
    const receiptType = `WOMPI_TX_${txIdentifier}`;

    this.logger.log(`Transacción APROBADA (${txIdentifier}) para organización: ${organizationId}`);

    let txResult: {
      status: 'UPGRADED' | 'AGENCY_PRESERVED';
      orgName: string;
      newExpiresAt: Date | null;
    };

    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        const org = await tx.organization.findUnique({ where: { id: organizationId } });
        if (!org) {
          this.logger.error(`Organización no encontrada: ${organizationId}`);
          throw new BadRequestException('Organización no encontrada');
        }

        if (org.plan === 'AGENCY') {
          this.logger.log(`Organización ${organizationId} tiene plan AGENCY. Se conserva sin cambios.`);
          return { status: 'AGENCY_PRESERVED' as const, orgName: org.name, newExpiresAt: null };
        }

        // Registro atómico persistente del recibo único por transacción (protegido por @@unique([organizationId, type]))
        await tx.billingNotification.create({
          data: {
            organizationId,
            type: receiptType,
            message: `WOMPI_RECEIPT:${reference}`,
            emailSent: true,
          },
        });

        const now = new Date();
        let newExpiresAt = new Date(now);

        if (org.plan === 'PRO' && org.planExpiresAt && org.planExpiresAt > now) {
          // Extender desde la fecha de expiración actual si ya es PRO y no ha expirado
          newExpiresAt = new Date(org.planExpiresAt);
          newExpiresAt.setDate(newExpiresAt.getDate() + 30);
          this.logger.log(`Extendiendo plan PRO para ${organizationId} hasta ${newExpiresAt}`);
        } else {
          // Contar desde hoy si expiró o es la primera vez
          newExpiresAt.setDate(now.getDate() + 30);
          this.logger.log(`Nuevo plan PRO para ${organizationId} válido hasta ${newExpiresAt}`);
        }

        // Actualizar el plan a PRO y establecer expiración
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            plan: 'PRO',
            planExpiresAt: newExpiresAt,
            hadPro: true,
          },
        });

        // Limpiar únicamente avisos de expiración visibles al usuario, conservando recibos WOMPI_TX_*
        await tx.billingNotification.deleteMany({
          where: {
            organizationId,
            type: { in: ['EXPIRED', 'EXPIRING_SOON'] },
          },
        });

        return { status: 'UPGRADED' as const, orgName: org.name, newExpiresAt };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        this.logger.log(`Pago ${receiptType} ya procesado en BD para organización ${organizationId}. Se omite duplicado.`);
        return { success: true, status: 'ALREADY_PROCESSED' };
      }
      throw error;
    }

    if (txResult.status === 'AGENCY_PRESERVED') {
      return { success: true, status: 'AGENCY_PRESERVED' };
    }

    // Enviar correo de éxito a los administradores
    const admins = await this.prisma.user.findMany({
      where: { organizationId, role: 'ADMIN' }
    });

    for (const admin of admins) {
      await this.mailService.sendPaymentSuccessEmail(admin.email, txResult.orgName, txResult.newExpiresAt!);
    }

    this.logger.log(`✅ Organización ${organizationId} actualizada a PRO exitosamente, alertas limpiadas y correo enviado`);

    return { success: true, status: 'UPGRADED', expiresAt: txResult.newExpiresAt };
  }

  async getMetrics() {
    const totalOrganizations = await this.prisma.organization.count();
    const totalFreeOrganizations = await this.prisma.organization.count({ where: { plan: 'FREE' } });
    const totalProOrganizations = await this.prisma.organization.count({ where: { plan: 'PRO' } });
    const totalAgencyOrganizations = await this.prisma.organization.count({ where: { plan: 'AGENCY' } });

    const PRO_MONTHLY_PRICE = 45000;
    const monthlyRecurringRevenue = totalProOrganizations * PRO_MONTHLY_PRICE;
    const annualRunRate = monthlyRecurringRevenue * 12;

    const baseForConversion = totalFreeOrganizations + totalProOrganizations;
    const conversionRate = baseForConversion > 0 ? (totalProOrganizations / baseForConversion) : 0;

    const now = new Date();
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(now.getDate() + 5);

    const expiringSoon = await this.prisma.organization.count({
      where: {
        plan: 'PRO',
        planExpiresAt: {
          lte: fiveDaysFromNow,
          gte: now,
        },
      },
    });

    const expiredSubscriptions = await this.prisma.organization.count({
      where: {
        plan: 'FREE',
        hadPro: true,
      },
    });

    return {
      totalOrganizations,
      totalFreeOrganizations,
      totalProOrganizations,
      totalAgencyOrganizations,
      monthlyRecurringRevenue,
      annualRunRate,
      conversionRate,
      expiringSoon,
      expiredSubscriptions,
    };
  }

  async getSubscriptions() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(now.getDate() + 5);

    return orgs.map(org => {
      let status = 'ACTIVE';
      if (org.plan === 'FREE' && org.hadPro) {
        status = 'EXPIRED';
      } else if (org.plan === 'PRO' && org.planExpiresAt && org.planExpiresAt <= fiveDaysFromNow && org.planExpiresAt >= now) {
        status = 'EXPIRING_SOON';
      } else if (org.plan === 'PRO' && org.planExpiresAt && org.planExpiresAt < now) {
        // Technically it should have been caught by the cron, but just in case
        status = 'EXPIRED';
      }

      return {
        id: org.id,
        organizationName: org.name,
        currentPlan: org.plan,
        expirationDate: org.planExpiresAt,
        status,
      };
    });
  }

  async getNotifications(organizationId: string) {
    if (!organizationId) {
      return [];
    }

    return this.prisma.billingNotification.findMany({
      where: {
        organizationId,
        type: { in: ['EXPIRED', 'EXPIRING_SOON'] },
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
