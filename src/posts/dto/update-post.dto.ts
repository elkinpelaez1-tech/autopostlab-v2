import { PartialType } from '@nestjs/mapped-types';
import { CreatePostDto } from './create-post.dto';

/**
 * DTO para actualizar un post.
 * Hereda de CreatePostDto pero todos los campos son opcionales.
 * Esto permite actualizar solo el campo necesario.
 */
export class UpdatePostDto extends PartialType(CreatePostDto) {}
