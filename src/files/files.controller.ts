import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Get,
  Delete,
  Param,
  UseGuards,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('files')
@UseGuards(JwtAuthGuard) // 🔒 Seguridad Reactivada en el Paso 4
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload/:workspaceId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('workspaceId') workspaceId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|mp4|webm|quicktime|mov)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    console.log('UPLOAD FILE RECEIVED:', file);
    const saved = await this.filesService.uploadFile(workspaceId, file);
    return {
      message: 'Medio multimedia subido exitosamente a Cloudinary',
      file: saved,
    };
  }

  @Get('workspace/:workspaceId')
  async findAll(@Param('workspaceId') workspaceId: string) {
    return this.filesService.findAll(workspaceId);
  }

  @Delete(':id/workspace/:workspaceId')
  async remove(
    @Param('id') id: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.filesService.remove(id, workspaceId);
  }
}
