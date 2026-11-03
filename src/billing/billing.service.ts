import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly PRO_PRICE_CENTS = 4500000; // $45.000 COP / 12 meses (pago único, sin renovación automática)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService
  ) {}

  private addTwelveMonths(baseDate: Date): Date {
    const result = new Date(baseDate.getTime());
    const targetMonth = result.getMonth();
    result.setFullYear(result.getFullYear() + 1);
    // Ajustar 29 de febrero en año bisiesto a 28 de febrero del año siguiente
    if (result.getMonth() !== targetMonth) {
      result.setDate(0);
    }
    return result;
  }

  async createCheckout(organizationId: string, plan: string) {
    if (plan !== 'PRO') {
      throw new BadRequestException('Solo se soporta el plan PRO por ahora');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!org) throw new BadRequestException('Organización no encontrada');
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

    const reference = String(transaction.reference || '').trim();

    // =========================================================================
    // ENRUTAMIENTO MULTI-APLICACIÓN WOMPI (CREVENTIS S.A.S.)
    // =========================================================================
    // 1. Destino: Mi Consumo (referencias que inician con 'MC-')
    if (reference.startsWith('MC-')) {
      const targetUrl = (
        process.env.MICONSUMO_WEBHOOK_URL ||
        'https://hiebektdunslzdyhuqzs.supabase.co/functions/v1/wompi-webhook'
      ).trim();
      this.logger.log(`[ROUTER_WOMPI] Enrutando evento a Mi Consumo (ref: ${this.maskReference(reference)})`);
      return this.forwardWebhook(targetUrl, 'Mi Consumo', body, signatureHeader);
    }

    // 2. Destino: VisaScore (referencias con formato canónico UUID)
    if (UUID_REGEX.test(reference)) {
      const targetUrl = (
        process.env.VISASCORE_WEBHOOK_URL ||
        'https://visascore.onrender.com/payments/webhook'
      ).trim();
      this.logger.log(`[ROUTER_WOMPI] Enrutando evento a VisaScore (ref: ${this.maskReference(reference)})`);
      return this.forwardWebhook(targetUrl, 'VisaScore', body, signatureHeader);
    }

    // 3. Destino: AutoPostLab (referencias que inician con 'UPG-')
    if (reference.startsWith('UPG-')) {
      this.logger.log(`[ROUTER_WOMPI] Procesando evento en AutoPostLab (ref: ${this.maskReference(reference)})`);
      // Continúa abajo con la lógica local de AutoPostLab
    } else {
      // 4. Referencia desconocida: respuesta segura sin procesamiento ni error 400
      this.logger.warn(`[ROUTER_WOMPI] Referencia no reconocida o ajena: ${this.maskReference(reference)}. Ignorando de forma segura.`);
      return { success: true, message: 'Referencia no corresponde a upgrade' };
    }

    const status = transaction.status;
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
        let newExpiresAt: Date;

        if (org.planExpiresAt && org.planExpiresAt > now) {
          // Extender 12 meses desde la fecha de vencimiento vigente sin perder días pagados
          newExpiresAt = this.addTwelveMonths(new Date(org.planExpiresAt));
          this.logger.log(`Extendiendo plan PRO anual (+12 meses) para ${organizationId} hasta ${newExpiresAt}`);
        } else {
          // Activar por 12 meses desde hoy si es primera vez o si el período anterior ya venció
          newExpiresAt = this.addTwelveMonths(now);
          this.logger.log(`Nuevo plan PRO anual (12 meses) para ${organizationId} válido hasta ${newExpiresAt}`);
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

  private maskReference(ref: string): string {
    if (!ref) return 'EMPTY';
    if (ref.length <= 12) return ref;
    return `${ref.slice(0, 8)}...${ref.slice(-4)}`;
  }

  private async forwardWebhook(
    targetUrl: string,
    destinationLabel: string,
    body: any,
    signatureHeader?: string,
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const effectiveChecksum = signatureHeader || body?.signature?.checksum;
    if (effectiveChecksum) {
      headers['x-event-checksum'] = String(effectiveChecksum).trim();
    }

    const controller = new AbortController();
    const timeoutMs = Number(process.env.ROUTER_FORWARD_TIMEOUT_MS) || 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData: any = null;
      try {
        responseData = JSON.parse(responseText);
      } catch (_e) {
        responseData = { raw: responseText };
      }

      // Si el destino responde con código no exitoso (!response.ok):
      // NUNCA responder HTTP 200 a Wompi. Lanzar BadGatewayException (HTTP 502) para activar la política de reintentos.
      if (!response.ok) {
        this.logger.error(
          `[ROUTER_WOMPI] Destino [${destinationLabel}] respondió HTTP ${response.status}`,
        );

        // Devolvemos 502 Bad Gateway para asegurar que Wompi active su política de reintentos
        // sin importar si el destino respondió 4xx (ej. 404 transitorio por retardo de escritura) o 5xx.
        throw new BadGatewayException(
          `Fallo en servicio destino [${destinationLabel}] (HTTP ${response.status})`,
        );
      }

      return {
        success: true,
        forwardedStatus: response.status,
        response: responseData,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      // Si ya es una HttpException de NestJS (BadGateway), relanzarla intacta
      if (err instanceof HttpException) {
        throw err;
      }

      // Si la petición fue abortada por timeout del AbortController:
      if (err?.name === 'AbortError' || err?.code === 20) {
        this.logger.error(
          `[ROUTER_WOMPI] Timeout (${timeoutMs}ms) contactando destino [${destinationLabel}]`,
        );
        throw new GatewayTimeoutException(
          `Tiempo de espera agotado (${timeoutMs}ms) contactando servicio destino [${destinationLabel}]`,
        );
      }

      this.logger.error(
        `[ROUTER_WOMPI] Error de conexión de red hacia destino [${destinationLabel}]: ${err?.message}`,
      );
      throw new BadGatewayException(
        `Error de conectividad de red con servicio destino [${destinationLabel}]`,
      );
    }
  }

  async getMetrics() {
    const totalOrganizations = await this.prisma.organization.count();
    const totalFreeOrganizations = await this.prisma.organization.count({ where: { plan: 'FREE' } });
    const totalProOrganizations = await this.prisma.organization.count({ where: { plan: 'PRO' } });
    const totalAgencyOrganizations = await this.prisma.organization.count({ where: { plan: 'AGENCY' } });

    const PRO_ANNUAL_PRICE = 45000;
    const annualRunRate = totalProOrganizations * PRO_ANNUAL_PRICE;
    const monthlyRecurringRevenue = Math.round(annualRunRate / 12);

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
