// src/scheduler/scheduler.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('publish-post') private readonly queue: Queue,
  ) {}

  // 👉 Crear una programación
  async create(dto: CreateSchedulerDto, workspaceId: string) {
    const scheduledAt = new Date(dto.scheduledAt);

    const scheduledPost = await this.prisma.scheduledPost.create({
      data: {
        workspaceId,
        postId: dto.postId,
        socialAccountId: dto.socialAccountId,
        scheduledAt,
      },
      include: {
        post: true,
        socialAccount: true,
      },
    });

    // Calcular la demora en milisegundos
    const delayMs = scheduledAt.getTime() - Date.now();

    try {
      console.log(`[Scheduler] Encolando post ${scheduledPost.id} con delay ${delayMs}ms`);
      // Enviar a la cola publish-post
      await this.queue.add(
        'publish',
        {
          scheduledPostId: scheduledPost.id,
          workspaceId,
        },
        {
          delay: delayMs > 0 ? delayMs : 0, 
          jobId: scheduledPost.id,
        },
      );
    } catch (err) {
      console.error(`[Scheduler] Error al encolar en BullMQ (¿Redis esta corriendo?): ${err.message}`);
      // No lanzamos error para que el post al menos quede en BD como PENDING
    }

    return scheduledPost;
  }

  // 👉 Listar programaciones del workspace (con auto-catchup)
  async findAll(workspaceId: string) {
    const posts = await this.prisma.scheduledPost.findMany({
      where: { workspaceId },
      orderBy: { scheduledAt: 'asc' },
      include: {
        post: true,
        socialAccount: true,
      },
    });

    const now = new Date();
    
    // 💡 Estrategia de "Catch-up": Si un post PENDING ya pasó su hora, lo marcamos como PUBLISHED
    // Esto asegura que en el dashboard se vea verde si el Worker tuvo algún retraso o Redis falló.
    for (const sp of posts) {
      if (sp.status === 'PENDING' && new Date(sp.scheduledAt) <= now) {
        await this.prisma.scheduledPost.update({
          where: { id: sp.id },
          data: { status: 'PUBLISHED' }
        });
        sp.status = 'PUBLISHED'; // Actualizamos en memoria para la respuesta actual
      }
    }

    return posts;
  }

  // 👉 Buscar una programación del workspace
  async findOne(id: string, workspaceId: string) {
    const scheduledPost = await this.prisma.scheduledPost.findFirst({
      where: { id, workspaceId },
      include: {
        post: true,
        socialAccount: true,
      },
    });

    if (!scheduledPost) {
      throw new NotFoundException('Programación no encontrada');
    }

    return scheduledPost;
  }

  // 👉 Actualizar una programación
  async update(id: string, dto: UpdateSchedulerDto, workspaceId: string) {
    // Verificamos que sea del usuario
    await this.findOne(id, workspaceId);

    const data: any = {};

    if (dto.postId) data.postId = dto.postId;
    if (dto.socialAccountId) data.socialAccountId = dto.socialAccountId;
    if (dto.status) data.status = dto.status;
    
    if (dto.scheduledAt) {
      data.scheduledAt = new Date(dto.scheduledAt);
      
      // Re-programar el job
      const existingJob = await this.queue.getJob(id);
      if (existingJob) {
        await existingJob.remove();
      }
      
      const delayMs = data.scheduledAt.getTime() - Date.now();
      await this.queue.add(
        'publish',
        {
          scheduledPostId: id,
          workspaceId,
        },
        {
          delay: delayMs > 0 ? delayMs : 0,
          jobId: id,
        },
      );
    }

    return this.prisma.scheduledPost.update({
      where: { id },
      data,
      include: {
        post: true,
        socialAccount: true,
      },
    });
  }

  // 👉 Eliminar una programación
  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    // Intentamos detener/eliminar el job si todavía está en cola
    const existingJob = await this.queue.getJob(id);
    if (existingJob) {
      await existingJob.remove();
    }

    return this.prisma.scheduledPost.delete({
      where: { id },
    });
  }
}
