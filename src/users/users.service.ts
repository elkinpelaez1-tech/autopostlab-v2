import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return user;
  }

  // -------------------------------------------------------
  // ✏️ Actualizar usuario (con re-hash si cambia contraseña)
  // -------------------------------------------------------
  async update(id: string, data: UpdateUserDto) {
    const exists = await this.findOne(id);

    let password = exists.password;

    // Rehash si mandan una contraseña nueva
    if (data.password) {
      password = await bcrypt.hash(data.password, 10);
    }

    // --- PROTECCIÓN DE DATOS SENSIBLES ---
    // Si avatarUrl viene vacío o null en un update general, mantenemos la anterior
    const cleanData: any = { ...data };
    if (!cleanData.avatarUrl && exists.avatarUrl) {
       delete cleanData.avatarUrl;
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
