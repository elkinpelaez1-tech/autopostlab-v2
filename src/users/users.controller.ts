import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard) // 🔒 Protección global para todos los endpoints de este controlador
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AdminGuard) // 🛡️ Sólo administradores globales pueden crear usuarios directamente
  @Post()
  create(@Body() data: CreateUserDto) {
    return this.usersService.create(data);
  }

  @Get('me')
  getProfile(@GetUser() user: any) {
    return this.usersService.findOne(user.sub || user.id);
  }

  @UseGuards(AdminGuard) // 🛡️ Sólo administradores globales pueden listar todos los usuarios
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() requester: any) {
    const reqId = requester.sub || requester.id;
    const isAdmin = requester.email?.toLowerCase() === process.env.GLOBAL_ADMIN_EMAIL?.toLowerCase();

    // Si no es el propio usuario y no es admin, denegar acceso
    if (reqId !== id && !isAdmin) {
      throw new ForbiddenException('No tienes autorización para consultar este perfil.');
    }

    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateUserDto, @GetUser() requester: any) {
    const reqId = requester.sub || requester.id;
    const isAdmin = requester.email?.toLowerCase() === process.env.GLOBAL_ADMIN_EMAIL?.toLowerCase();

    // Validar propiedad: Un usuario solo puede actualizarse a sí mismo, a menos que sea Admin
    if (reqId !== id && !isAdmin) {
      throw new ForbiddenException('No tienes autorización para modificar este perfil.');
    }

    return this.usersService.update(id, data, isAdmin);
  }

  @UseGuards(AdminGuard) // 🛡️ Sólo administradores globales pueden eliminar usuarios
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
