import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly frontendUrl: string;

  constructor() {
    this.frontendUrl = process.env.FRONTEND_URL || 'https://app.autopostlab.me';

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

  private async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      if (!process.env.SMTP_USER && process.env.NODE_ENV !== 'development') {
         this.logger.warn(`SMTP no configurado, omitiendo correo a ${to}`);
         return false;
      }

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Autopostlab" <no-reply@autopostlab.com>',
        to,
        subject,
        html,
      });
      this.logger.log(`Correo enviado exitosamente a ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Error al enviar correo a ${to}`, error);
      return false;
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
    const subject = '⚠️ Tu plan PRO anual expirará pronto';
    const upgradeUrl = `${this.frontendUrl}/dashboard?action=upgrade`;
    
    const content = `
      <p>Hola <strong>${orgName}</strong>,</p>
      <p>Te escribimos para recordarte que tu plan <strong>PRO anual</strong> está próximo a expirar en los siguientes 5 días.</p>
      <p>Recuerda que tu plan es de pago único y no tiene renovación automática. Si deseas continuar, realiza un nuevo pago único por 12 meses para mantener todas las herramientas avanzadas sin interrupciones.</p>
      <div style="text-align: center;">
        <a href="${upgradeUrl}" class="btn btn-warning" style="color: white;">Renovar por 12 meses</a>
      </div>
    `;

    await this.sendMail(email, subject, this.getBaseTemplate('Aviso de expiración', content));
  }

  async sendExpiredEmail(email: string, orgName: string) {
    const subject = '🚨 Tu plan PRO anual ha expirado';
    const upgradeUrl = `${this.frontendUrl}/dashboard?action=upgrade`;
    
    const content = `
      <p>Hola <strong>${orgName}</strong>,</p>
      <p>Te informamos que tu plan <strong>PRO anual</strong> ha expirado y tu cuenta ha vuelto al plan <strong>FREE</strong>.</p>
      <p>Puedes reactivar tu plan en cualquier momento mediante un pago único por 12 meses (sin renovación automática) para seguir disfrutando de todas nuestras ventajas.</p>
      <div style="text-align: center;">
        <a href="${upgradeUrl}" class="btn btn-danger" style="color: white;">Volver a PRO</a>
      </div>
    `;

    await this.sendMail(email, subject, this.getBaseTemplate('Suscripción expirada', content));
  }

  async sendPaymentSuccessEmail(email: string, orgName: string, expiresAt: Date) {
    const subject = '🎉 ¡Pago confirmado! Plan PRO Anual activo';
    const formattedDate = expiresAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const dashboardUrl = `${this.frontendUrl}/dashboard`;
    
    const content = `
      <p>¡Excelentes noticias <strong>${orgName}</strong>!</p>
      <p>Hemos recibido tu pago único con éxito. Tu cuenta ahora cuenta con el plan <strong>PRO Anual (12 meses, sin renovación automática)</strong>.</p>
      <p>Tu plan estará activo hasta el: <strong>${formattedDate}</strong>.</p>
      <p>Disfruta de la mejor experiencia gestionando tus redes sociales de manera profesional.</p>
      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="btn" style="color: white;">Ir al Dashboard</a>
      </div>
    `;

    await this.sendMail(email, subject, this.getBaseTemplate('¡Gracias por tu compra!', content));
  }

  async sendPasswordResetEmail(email: string, resetUrl: string, name?: string): Promise<boolean> {
    const subject = '🔐 Restablece tu contraseña - AutoPostLab';
    const displayName = name || 'Usuario';
    
    const content = `
      <p>Hola <strong>${displayName}</strong>,</p>
      <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en AutoPostLab.</p>
      <p>Haz clic en el siguiente botón para elegir una nueva contraseña:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" class="btn" style="color: white; background-color: #6366f1; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Restablecer mi contraseña</a>
      </div>
      <p style="font-size: 14px; color: #6b7280;">O copia y pega este enlace en tu navegador:</p>
      <p style="font-size: 13px; word-break: break-all; color: #4f46e5;"><a href="${resetUrl}" style="color: #4f46e5;">${resetUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;" />
      <p style="font-size: 13px; color: #9ca3af;">Por seguridad, este enlace es de un solo uso y expirará en 1 hora.</p>
      <p style="font-size: 13px; color: #9ca3af;">Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual permanecerá segura y sin cambios.</p>
    `;

    return await this.sendMail(email, subject, this.getBaseTemplate('Recuperación de contraseña', content));
  }
}
