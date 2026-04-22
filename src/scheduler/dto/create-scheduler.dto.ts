// src/scheduler/dto/create-scheduler.dto.ts
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateSchedulerDto {
  @IsString()
  @IsNotEmpty()
  postId: string;

  @IsString()
  @IsNotEmpty()
  socialAccountId: string;

  // Usamos string en formato ISO (ej: "2025-12-01T15:00:00.000Z")
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;
}
