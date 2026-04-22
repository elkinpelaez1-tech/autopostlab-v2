// src/scheduler/scheduler.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('scheduler')
@UseGuards(JwtAuthGuard)
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  // 📌 Crear programación
  @Post()
  create(@Body() dto: CreateSchedulerDto, @Req() req: any) {
    const workspaceId = req.user.workspaceId; // 👈 IMPORTANTE
    return this.schedulerService.create(dto, workspaceId);
  }

  // 📌 Listar programaciones del usuario
  @Get()
  findAll(@Req() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.schedulerService.findAll(workspaceId);
  }

  // 📌 Obtener una programación
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.schedulerService.findOne(id, workspaceId);
  }

  // 📌 Actualizar programación
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSchedulerDto,
    @Req() req: any,
  ) {
    const workspaceId = req.user.workspaceId;
    return this.schedulerService.update(id, dto, workspaceId);
  }

  // 📌 Eliminar programación
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const workspaceId = req.user.workspaceId;
    return this.schedulerService.remove(id, workspaceId);
  }
}
