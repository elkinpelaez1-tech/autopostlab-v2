import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { User, Role } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;
  private readonly resetRateLimit = new Map<string, { count: number; firstAttempt: number; lastAttempt: number }>();
  private readonly invalidatedResetTokens = new Set<string>();

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    this.logger.log('Google Auth Service Inicializado');
  }

  // -------------------------------------------------------
  // 🧪 Validar credenciales del usuario
  // -------------------------------------------------------
  private async validateUser(email: string, pass: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordOk = await bcrypt.compare(pass, user.password);

    if (!passwordOk) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return user;
  }

  // -------------------------------------------------------
  // 🔐 LOGIN (GÉNERA ACCESS Y REFRESH TOKEN)
  // -------------------------------------------------------
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);

    // Buscar un workspace predeterminado (el primero que sea dueño)
    const ownedWorkspace = await this.prisma.workspace.findFirst({ where: { ownerId: user.id } });
    const workspaceId = ownedWorkspace?.id || null;

    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      workspaceId: workspaceId,
      organizationId: user.organizationId,
      avatarUrl: user.avatarUrl,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '24h', // Tiempo extendido para evitar desconexiones en dev
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    const hashedRt = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRt },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  // -------------------------------------------------------
  // 🌟 GOOGLE OAUTH LOGIN (NUEVO FLUJO PASO 4)
  // -------------------------------------------------------
  async loginWithGoogle(token: string) {
    let payload;
    try {
      this.logger.log('Validando Token de Google...');
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
      this.logger.log(`Token validado para email: ${payload?.email}`);
    } catch (e) {
      this.logger.error('Error validando token de Google:', e.message);
      throw new UnauthorizedException('Token de Google inválido (Firma no reconocida)');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('El token de Google no contiene email');
    }

    const { email, name, sub: googleId } = payload;

    // 1. Buscar si el usuario ya existe en nuestra base de datos (con sus workspaces)
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { ownedWorkspaces: true }
    });

    let workspaceId = '';

    // 2. Si no existe, lo Registramos silenciosamente
    if (!user) {
      this.logger.log(`Registrando nuevo usuario por Google: ${email}`);
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await this.prisma.user.create({
        data: {
          email,
          name: name || 'Usuario de Autopostlab',
          password: hashedPassword,
          role: Role.ADMIN, 
          organization: {
            create: {
              name: 'Mi empresa',
            }
          },
          ownedWorkspaces: {
            create: {
              name: `Workspace de ${name || email.split('@')[0]}`,
            }
          }
        },
        include: { ownedWorkspaces: true, organization: true }
      });
      workspaceId = user.ownedWorkspaces[0].id;
      this.logger.log(`Nuevo usuario creado con Workspace: ${workspaceId}`);
    } else {
      this.logger.log(`Usuario existente logueado: ${email}`);
      if (!user.ownedWorkspaces || user.ownedWorkspaces.length === 0) {
         this.logger.warn(`Usuario ${email} no tiene workspace. Creando uno de emergencia...`);
         const newWorkspace = await this.prisma.workspace.create({
           data: { name: `Workspace de ${user.name || 'Trabajo'}`, ownerId: user.id }
         });
         workspaceId = newWorkspace.id;
      } else {
         workspaceId = user.ownedWorkspaces[0].id;
      }
      this.logger.log(`Acceso concedido a Workspace: ${workspaceId}`);
    }

    // 4. Emitimos nuestros propios JWT (ya estamos logueados en Autopostlab)
    const jwtPayload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      workspaceId: workspaceId, // <-- INYECTAMOS EL WORKSPACE REAL EN EL JWT
      organizationId: user.organizationId,
      avatarUrl: user.avatarUrl,
    };

    const accessToken = await this.jwtService.signAsync(jwtPayload, { expiresIn: '24h' }); // Tiempo extendido para dev
    const refreshToken = await this.jwtService.signAsync(jwtPayload, { expiresIn: '7d' });
    const hashedRt = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRt },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      workspaceId, // Devuelto explícitamente para el Frontend
    };
  }

  // -------------------------------------------------------
  // 🔄 REFRESCAR ACCESS TOKEN
  // -------------------------------------------------------
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('No se envió refresh token');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken);
    } catch (e) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const rtMatches = await bcrypt.compare(refreshToken, user.refreshToken);

    if (!rtMatches) {
      throw new UnauthorizedException('Refresh token no coincide');
    }

    // Obtener el primer workspace que posee el usuario para el nuevo token
    const ownedWorkspace = await this.prisma.workspace.findFirst({ where: { ownerId: user.id } });
    const workspaceId = ownedWorkspace?.id || null;

    const newAccessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        workspaceId: workspaceId,
        organizationId: user.organizationId,
        avatarUrl: user.avatarUrl,
      },
      { expiresIn: '24h' },
    );

    return {
      accessToken: newAccessToken,
    };
  }

  // -------------------------------------------------------
  // 🔴 LOGOUT (INVALIDA REFRESH TOKEN)
  // -------------------------------------------------------
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logout exitoso' };
  }

  // -------------------------------------------------------
  // 📧 RECUPERACIÓN DE CONTRASEÑA (SOLICITAR ENLACE)
  // -------------------------------------------------------
  async forgotPassword(email: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();

    // 1. Protección contra abuso / rate limiting
    const now = Date.now();
    const record = this.resetRateLimit.get(normalizedEmail);
    if (record) {
      if (now - record.firstAttempt > 15 * 60 * 1000) {
        this.resetRateLimit.set(normalizedEmail, { count: 1, firstAttempt: now, lastAttempt: now });
      } else {
        if (now - record.lastAttempt < 60 * 1000) {
          this.logger.warn(`Recuperación de contraseña throttled (<60s) para ${normalizedEmail}`);
          // Respuesta anti-enumeración uniforme
          return {
            success: true,
            message: 'Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos.',
          };
        }
        record.count += 1;
        record.lastAttempt = now;
      }
    } else {
      this.resetRateLimit.set(normalizedEmail, { count: 1, firstAttempt: now, lastAttempt: now });
    }

    // 2. Búsqueda de usuario (anti-enumeración)
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      this.logger.log(`Solicitud de recuperación para correo inexistente: ${normalizedEmail}`);
      return {
        success: true,
        message: 'Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos.',
      };
    }

    // 3. Generación de huella criptográfica de contraseña actual
    const secret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret';
    const pwdFingerprint = crypto
      .createHmac('sha256', secret)
      .update(user.password)
      .digest('hex')
      .substring(0, 16);

    // 4. Token firmado con expiración de 1 hora y huella única
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      purpose: 'pwd_reset',
      v: pwdFingerprint,
    };

    const resetToken = await this.jwtService.signAsync(tokenPayload, {
      expiresIn: '1h',
    });

    const frontendBase = (process.env.FRONTEND_URL || 'https://app.autopostlab.me').replace(/\/+$/, '');
    const resetUrl = `${frontendBase}/reset-password?token=${encodeURIComponent(resetToken)}`;

    this.logger.log(`Enviando correo de recuperación a: ${user.email}`);
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl, user.name || undefined);

    return {
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos.',
      // Facilitar URL de reset si no hay SMTP configurado o en entorno de desarrollo/test
      ...(!process.env.SMTP_USER || process.env.NODE_ENV === 'development' ? { resetUrl } : {}),
    };
  }

  // -------------------------------------------------------
  // 🔑 RESTABLECER CONTRASEÑA CON TOKEN SEGURO
  // -------------------------------------------------------
  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new BadRequestException('El token y la nueva contraseña son requeridos');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
    }

    if (this.invalidatedResetTokens.has(token)) {
      throw new BadRequestException('Este enlace de recuperación ya ha sido utilizado.');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch (err) {
      this.logger.warn(`Token de recuperación inválido o expirado: ${err.message}`);
      throw new BadRequestException('El enlace de recuperación es inválido o ha expirado.');
    }

    if (payload?.purpose !== 'pwd_reset' || !payload?.sub || !payload?.v) {
      throw new BadRequestException('El enlace de recuperación no es válido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new BadRequestException('El usuario asociado a este enlace ya no existe.');
    }

    // Comprobar huella de contraseña actual para garantizar uso único
    const secret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret';
    const currentFingerprint = crypto
      .createHmac('sha256', secret)
      .update(user.password)
      .digest('hex')
      .substring(0, 16);

    if (currentFingerprint !== payload.v) {
      this.logger.warn(`Token reutilizado para usuario ${user.email} (la contraseña ya fue cambiada)`);
      throw new BadRequestException('Este enlace de recuperación ya ha sido utilizado.');
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña y revocar sesiones activas
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        refreshToken: null,
      },
    });

    // Revocar tokens en tabla RefreshToken si existen
    try {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revoked: false },
        data: { revoked: true },
      });
    } catch (rtErr) {
      this.logger.warn(`Error al revocar registros de RefreshToken: ${rtErr.message}`);
    }

    // Añadir a lista negra de tokens en memoria
    this.invalidatedResetTokens.add(token);

    this.logger.log(`Contraseña actualizada exitosamente para ${user.email}. Sesiones anteriores revocadas.`);

    return {
      success: true,
      message: 'Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión con tu nueva contraseña.',
    };
  }
}
