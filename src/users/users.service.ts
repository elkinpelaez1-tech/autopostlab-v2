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
  // Usuario: humberto856247@hotmail.com | Periodo: 23/10/2026 -> 23/10/2027 (Pago anual en efectivo)
  // -------------------------------------------------------
  private readonly MANUAL_PRO_EMAIL = 'humberto856247@hotmail.com';
  private readonly MANUAL_PRO_EXPIRATION = new Date('2027-10-23T23:59:59.999Z');

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.applyManualProAccess();
  }

  private async applyManualProAccess() {
    try {
      const user = await this.prisma.user.findFirst({
        where: { email: { equals: this.MANUAL_PRO_EMAIL, mode: 'insensitive' } },
        include: { organization: true },
      });

      if (user) {
        await this.ensureManualProAccess(user);
      }
    } catch (error) {
      this.logger.warn(`[MANUAL PRO] Verificación inicial no completada: ${error.message}`);
    }
  }

  private async ensureManualProAccess(user: any) {
    if (!user || user.email?.toLowerCase() !== this.MANUAL_PRO_EMAIL || !user.organization) {
      return user?.organization;
    }

    const now = new Date();
    if (now <= this.MANUAL_PRO_EXPIRATION) {
      if (
        user.organization.plan !== 'PRO' ||
        !user.organization.planExpiresAt ||
        new Date(user.organization.planExpiresAt) < this.MANUAL_PRO_EXPIRATION
      ) {
        const updatedOrg = await this.prisma.organization.update({
          where: { id: user.organization.id },
          data: {
            plan: 'PRO',
            planExpiresAt: this.MANUAL_PRO_EXPIRATION,
            hadPro: true,
          },
        });

        // Limpiar avisos de expiración para esta organización
        await this.prisma.billingNotification.deleteMany({
          where: {
            organizationId: user.organization.id,
            type: { in: ['EXPIRED', 'EXPIRING_SOON'] },
          },
        });

        // Registro seguro de auditoría de pago manual en efectivo (sin simular Wompi)
        const existingReceipt = await this.prisma.billingNotification.findFirst({
          where: {
            organizationId: user.organization.id,
            type: 'MANUAL_CASH_PRO_2026',
          },
        });
        if (!existingReceipt) {
          await this.prisma.billingNotification.create({
            data: {
              organizationId: user.organization.id,
              type: 'MANUAL_CASH_PRO_2026',
              message: 'PAGO_EFECTIVO_PRO_ANUAL_45000_COP_2026_2027',
              emailSent: true,
            },
          });
        }

        this.logger.log(`[MANUAL PRO] Acceso PRO anual aplicado a ${this.MANUAL_PRO_EMAIL} hasta ${this.MANUAL_PRO_EXPIRATION.toISOString()}`);
        return updatedOrg;
      }
    }
    return user.organization;
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
      user.organization = await this.ensureManualProAccess(user);
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
