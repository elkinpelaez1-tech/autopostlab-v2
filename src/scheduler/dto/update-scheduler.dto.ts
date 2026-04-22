// src/scheduler/dto/update-scheduler.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateSchedulerDto } from './create-scheduler.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ScheduledStatus } from '@prisma/client';

export class UpdateSchedulerDto extends PartialType(CreateSchedulerDto) {
  // Permitir cambiar el estado (PENDING, PROCESSING, PUBLISHED, FAILED, CANCELLED)
  @IsOptional()
  @IsEnum(ScheduledStatus)
  status?: ScheduledStatus;
}
