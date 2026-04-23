import {
  Controller, Post, UseInterceptors, UploadedFile
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    console.log('UPLOAD ENDPOINT HIT:', file);
    return { message: "ok" };
  }
}
