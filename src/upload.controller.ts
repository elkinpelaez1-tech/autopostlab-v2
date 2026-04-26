import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files/files.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Controller('upload')
export class UploadController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
  }))
  async upload(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('Archivo es requerido');
    }

    const workspaceId = req.user.workspaceId || 'default-workspace';
    
    console.log(`[UPLOAD_START] Workspace: ${workspaceId}, File: ${file.originalname}, Size: ${file.size}, Mime: ${file.mimetype}`);
    
    try {
      const result = await this.filesService.uploadFile(workspaceId, file);
      console.log(`[UPLOAD_SUCCESS] File ${file.originalname} uploaded and saved in DB with ID: ${result.id}`);
      
      return {
        id: result.id, // 👈 CRITICAL: Debe ser el UUID de la base de datos para evitar errores de Foreign Key
        url: result.secure_url || result.url
      };
    } catch (error) {
      console.error(`[UPLOAD_ERROR] Workspace: ${workspaceId}, File: ${file.originalname}, Error:`, error.message || error);
      throw error;
    }
  }
}
