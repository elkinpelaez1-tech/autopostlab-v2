import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SocialAccountsService } from './social-accounts.service';
import { CreateSocialAccountDto } from './dto/create-social-account.dto';
import { UpdateSocialAccountDto } from './dto/update-social-account.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('social-accounts')
@UseGuards(JwtAuthGuard) // 👈 Rutas protegidas
export class SocialAccountsController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  // Crear una cuenta social (Facebook, Instagram, etc.)
  @Post()
  create(@Body() dto: CreateSocialAccountDto, @Req() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.socialAccountsService.create(dto, workspaceId);
  }

  // Listar cuentas conectadas del usuario
  @Get()
  findAll(@Req() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.socialAccountsService.findAll(workspaceId);
  }

  // Obtener una cuenta social por ID
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.socialAccountsService.findOne(id, workspaceId);
  }

  // Actualizar cuenta social
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSocialAccountDto, @Req() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.socialAccountsService.update(id, dto, workspaceId);
  }

  // Eliminar cuenta social
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.socialAccountsService.remove(id, workspaceId);
  }
}
