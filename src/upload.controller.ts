import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files/files.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Controller('upload')
export class UploadController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('Archivo es requerido');
    }

    const workspaceId = req.user.workspaceId || 'default-workspace';
    
    console.log(`[UPLOAD_START] Workspace: ${workspaceId}, File: ${file.originalname}`);
    
    const result = await this.filesService.uploadFile(workspaceId, file);
    
    console.log('UPLOAD RESULT:', result);
    
    // 🔥 Garantizar el formato esperado por el frontend
    return {
      id: result.public_id || result.id,
      url: result.secure_url || result.url
    };
  }
}
