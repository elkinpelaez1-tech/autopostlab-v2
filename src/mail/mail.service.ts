import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly frontendUrl: string;

  constructor() {
    this.frontendUrl = process.env.FRONTEND_URL || 'https://autopostlab.me';

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }

  private async sendMail(to: string, subject: string, html: string) {
    try {
      if (!process.env.SMTP_USER && process.env.NODE_ENV !== 'development') {
         this.logger.warn(`SMTP no configurado, omitiendo correo a ${to}`);
         return;
      }

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Autopostlab" <no-reply@autopostlab.com>',
        to,
        subject,
        html,
      });
      this.logger.log(`Correo enviado exitosamente a ${to}`);
    } catch (error) {
      this.logger.error(`Error al enviar correo a ${to}`, error);
    }
  }

  private getBaseTemplate(title: string, content: string) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: #111827; padding: 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.025em; }
          .content { padding: 40px 30px; color: #374151; font-size: 16px; line-height: 1.6; }
          .footer { background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
          .btn-danger { background-color: #ef4444; }
          .btn-warning { background-color: #f59e0b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>Autopostlab - Simplifica tu gestión de redes sociales.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendExpiringSoonEmail(email: string, orgName: string) {
    const subject = '⚠️ Tu suscripción PRO expirará pronto';
    const upgradeUrl = `${this.frontendUrl}/dashboard?action=upgrade`;
    
    const content = `
      <p>Hola <strong>${orgName}</strong>,</p>
      <p>Te escribimos para recordarte que tu suscripción <strong>PRO</strong> está próxima a expirar en los siguientes 5 días.</p>
      <p>Asegúrate de renovar a tiempo para no perder acceso a las herramientas avanzadas y seguir gestionando tus redes sociales sin interrupciones.</p>
      <div style="text-align: center;">
        <a href="${upgradeUrl}" class="btn btn-warning" style="color: white;">Renovar ahora</a>
      </div>
    `;

    await this.sendMail(email, subject, this.getBaseTemplate('Aviso de expiración', content));
  }

  async sendExpiredEmail(email: string, orgName: string) {
    const subject = '🚨 Tu plan PRO ha expirado';
    const upgradeUrl = `${this.frontendUrl}/dashboard?action=upgrade`;
    
    const content = `
      <p>Hola <strong>${orgName}</strong>,</p>
      <p>Te informamos que tu suscripción <strong>PRO</strong> ha expirado y tu cuenta ha vuelto al plan <strong>FREE</strong>.</p>
      <p>Todavía tienes la posibilidad de recuperar tu plan y seguir disfrutando de todas nuestras ventajas exclusivas. ¡Vuelve hoy mismo!</p>
      <div style="text-align: center;">
        <a href="${upgradeUrl}" class="btn btn-danger" style="color: white;">Volver a PRO</a>
      </div>
    `;

    await this.sendMail(email, subject, this.getBaseTemplate('Suscripción expirada', content));
  }

  async sendPaymentSuccessEmail(email: string, orgName: string, expiresAt: Date) {
    const subject = '🎉 ¡Pago confirmado! Eres PRO';
    const formattedDate = expiresAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const dashboardUrl = `${this.frontendUrl}/dashboard`;
    
    const content = `
      <p>¡Excelentes noticias <strong>${orgName}</strong>!</p>
      <p>Hemos recibido tu pago con éxito. Tu cuenta ahora se encuentra en el plan <strong>PRO</strong>.</p>
      <p>Tu próxima fecha de vencimiento es el: <strong>${formattedDate}</strong>.</p>
      <p>Disfruta de la mejor experiencia gestionando tus redes sociales de manera profesional.</p>
      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="btn" style="color: white;">Ir al Dashboard</a>
      </div>
    `;

    await this.sendMail(email, subject, this.getBaseTemplate('¡Gracias por tu compra!', content));
  }
}
