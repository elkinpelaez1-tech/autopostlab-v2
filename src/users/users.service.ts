import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  // -------------------------------------------------------
  // 🛡️ HABILITACIÓN ADMINISTRATIVA MANUAL (PUNTUAL)
  // Usuario: humberto856247@hotmail.com | Periodo: 22/09/2026 -> 22/10/2026
  // -------------------------------------------------------
  private readonly MANUAL_PRO_EMAIL = 'humberto856247@hotmail.com';
  private readonly MANUAL_PRO_EXPIRATION = new Date('2026-10-22T23:59:59.999Z');

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.applyManualProAccess();
  }

  private async applyManualProAccess() {
    try {
      const now = new Date();
      if (now <= this.MANUAL_PRO_EXPIRATION) {
        const user = await this.prisma.user.findFirst({
          where: { email: { equals: this.MANUAL_PRO_EMAIL, mode: 'insensitive' } },
          include: { organization: true },
        });

        if (user?.organization && (user.organization.plan !== 'PRO' || !user.organization.planExpiresAt)) {
          await this.prisma.organization.update({
            where: { id: user.organization.id },
            data: {
              plan: 'PRO',
              planExpiresAt: this.MANUAL_PRO_EXPIRATION,
              hadPro: true,
            },
          });
          this.logger.log(`[MANUAL PRO] Acceso PRO aplicado a ${this.MANUAL_PRO_EMAIL} hasta ${this.MANUAL_PRO_EXPIRATION.toISOString()}`);
        }
      }
    } catch (error) {
      this.logger.warn(`[MANUAL PRO] Verificación inicial no completada: ${error.message}`);
    }
  }

  // -------------------------------------------------------
  // 🔍 Buscar usuario por email (Login)
  // -------------------------------------------------------
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  // -------------------------------------------------------
  // ➕ Crear usuario (con HASH seguro)
  // -------------------------------------------------------
  async create(data: CreateUserDto) {
  // Encriptar la contraseña antes de guardar
  let hashedPass = '';
  if (data.password) {
    hashedPass = await bcrypt.hash(data.password, 10);
  }

  return this.prisma.user.create({
    data: {
      email: data.email,
      password: hashedPass,
      name: data.name,
    },
  });
}


  // -------------------------------------------------------
  // 📄 Obtener todos los usuarios
  // -------------------------------------------------------
  async findAll() {
    return this.prisma.user.findMany();
  }

  // -------------------------------------------------------
  // 🔎 Obtener usuario por ID
  // -------------------------------------------------------
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { organization: true }
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Validación puntual para humberto856247@hotmail.com
    if (user.email?.toLowerCase() === this.MANUAL_PRO_EMAIL && user.organization) {
      const now = new Date();
      if (now <= this.MANUAL_PRO_EXPIRATION) {
        if (user.organization.plan !== 'PRO' || !user.organization.planExpiresAt) {
          const updatedOrg = await this.prisma.organization.update({
            where: { id: user.organization.id },
            data: {
              plan: 'PRO',
              planExpiresAt: this.MANUAL_PRO_EXPIRATION,
              hadPro: true,
            },
          });
          user.organization = updatedOrg;
        }
      }
    }

    return user;
  }

  // -------------------------------------------------------
  // ✏️ Actualizar usuario (con re-hash si cambia contraseña)
  // -------------------------------------------------------
  async update(id: string, data: UpdateUserDto, isAdmin: boolean = false) {
    const exists = await this.findOne(id);

    let password = exists.password;

    // Rehash si mandan una contraseña nueva
    if (data.password) {
      password = await bcrypt.hash(data.password, 10);
    }

    // --- PROTECCIÓN DE DATOS SENSIBLES ---
    // Whitelist quirúrgico de campos actualizables por usuarios normales
    const cleanData: any = {};
    
    if (data.name !== undefined) cleanData.name = data.name;
    
    // Solo actualizar avatar si trae valor (lógica previa conservada de forma más limpia)
    if (data.avatarUrl) {
      cleanData.avatarUrl = data.avatarUrl;
    }

    // Si es un administrador, se le permite modificar campos estructurales
    if (isAdmin) {
      if (data.email) cleanData.email = data.email;
      if (data.role) cleanData.role = data.role;
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...cleanData,
        password,
      },
    });
  }

  // -------------------------------------------------------
  // 🗑️ Eliminar usuario
  // -------------------------------------------------------
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.user.delete({
      where: { id },
    });
  }
}
