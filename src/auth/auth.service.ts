import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { User, Role } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
      email: user.email,
      role: user.role,
      workspaceId: workspaceId,
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
          role: Role.USER, 
          ownedWorkspaces: {
            create: {
              name: `Workspace de ${name || email.split('@')[0]}`,
            }
          }
        },
        include: { ownedWorkspaces: true }
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
      email: user.email,
      role: user.role,
      workspaceId: workspaceId, // <-- INYECTAMOS EL WORKSPACE REAL EN EL JWT
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
        email: user.email,
        role: user.role,
        workspaceId: workspaceId,
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
}
