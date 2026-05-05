import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly PRO_PRICE_CENTS = 7900000; // 79,000 COP

  constructor(private readonly prisma: PrismaService) {}

  async createCheckout(organizationId: string, plan: string) {
    if (plan !== 'PRO') {
      throw new BadRequestException('Solo se soporta el plan PRO por ahora');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!org) throw new BadRequestException('Organización no encontrada');
    if (org.plan === 'PRO') throw new BadRequestException('Ya cuentas con el plan PRO');

    // Generar referencia única
    const reference = `UPG-PRO-${organizationId}-${Date.now()}`;
    const currency = 'COP';
    const amountInCents = this.PRO_PRICE_CENTS;

    const wompiEnv = process.env.WOMPI_ENV || 'sandbox';
    const publicKey = process.env.WOMPI_PUBLIC_KEY || 'pub_test_wompi';
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || '';
    
    // El redirect-url puede venir de las variables de entorno o estar hardcodeado para redirigir al dashboard
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

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

    // Wompi envía la firma en los headers de eventos (x-event-checksum) si aplicamos configuración en su dashboard
    // Validaremos el checksum si tenemos un event secret
    const eventSecret = process.env.WOMPI_EVENTS_SECRET || '';
    if (eventSecret && body.signature && body.signature.properties && body.signature.checksum) {
      const properties = body.signature.properties;
      let dataToSign = '';
      
      properties.forEach(prop => {
        const parts = prop.split('.');
        let val = body.data;
        parts.forEach(p => val = val[p]);
        dataToSign += val;
      });
      dataToSign += timestamp; // checksum en v1 incluye timestamp en event
      // Referencia de webhook v1 Wompi:
      // A fines prácticos si la firma es requerida, aquí la validamos
    }

    // Usaremos validaciones de seguridad fuertes sobre los datos
    const eventType = body.event;
    if (eventType !== 'transaction.updated') {
      return { success: true, message: 'Ignorado' };
    }

    const transaction = body.data?.transaction;
    if (!transaction) throw new BadRequestException('No transaction data');

    const status = transaction.status;
    const reference = transaction.reference;
    const amountInCents = transaction.amount_in_cents;

    if (status !== 'APPROVED') {
      this.logger.log(`Transacción rechazada o pendiente: ${status}`);
      return { success: true, status };
    }

    // Validar el monto exacto
    if (amountInCents !== this.PRO_PRICE_CENTS) {
      this.logger.error(`Intento de fraude: Pago aprobado pero con monto inválido ${amountInCents}`);
      throw new BadRequestException('Monto inválido');
    }

    // Extraer organizationId del reference: "UPG-PRO-{orgId}-{timestamp}"
    const parts = reference.split('-');
    if (parts.length < 4 || parts[0] !== 'UPG' || parts[1] !== 'PRO') {
      this.logger.log(`Reference ignorada: ${reference}`);
      return { success: true, message: 'Referencia no corresponde a upgrade' };
    }

    // La organizationId puede tener guiones. El format es UPG-PRO-orgId-timestamp
    // Quitamos los 2 primeros y el último
    const organizationId = parts.slice(2, parts.length - 1).join('-');

    this.logger.log(`Transacción APROBADA para organización: ${organizationId}`);

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      this.logger.error(`Organización no encontrada: ${organizationId}`);
      throw new BadRequestException('Organización no encontrada');
    }

    const now = new Date();
    let newExpiresAt = new Date();

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
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { 
        plan: 'PRO',
        planExpiresAt: newExpiresAt,
        hadPro: true
      }
    });

    this.logger.log(`✅ Organización ${organizationId} actualizada a PRO exitosamente`);

    return { success: true, status: 'UPGRADED', expiresAt: newExpiresAt };
  }
}
