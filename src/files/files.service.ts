import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileProvider } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadFromBuffer(workspaceId: string, buffer: Buffer, filename: string, mimetype: string) {
    let uploadResult;
    try {
      uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { 
            folder: `autopostlab/${workspaceId}`,
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );
        uploadStream.end(buffer);
      });
      return uploadResult.secure_url;
    } catch (error) {
      console.error("Error uploading buffer to Cloudinary:", error);
      throw new BadRequestException('Error al subir archivo a Cloudinary');
    }
  }

  async uploadFile(workspaceId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo no detectado');

    let uploadResult;
    try {
      // Subir el buffer directo a cloudinary sin crear archivos temporales en disco
      uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: `autopostlab/${workspaceId}`,
          resource_type: 'auto', // 🔥 CRITICAL: Permite subir videos e imágenes
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        },
        (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );
        uploadStream.end(file.buffer);
      });
    } catch (cloudinaryError) {
      console.error("🔥 Error desde Cloudinary:", cloudinaryError);
      throw new BadRequestException(
        `Error real desde Cloudinary: ${cloudinaryError.message || JSON.stringify(cloudinaryError)}`
      );
    }

    // Guardar el registro permanente en Prisma asociado al Workspace
    try {
      const savedFile = await this.prisma.file.create({
        data: {
          workspaceId,
          url: uploadResult.secure_url,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          provider: FileProvider.CLOUDINARY,
        },
      });
      // Devolvemos una mezcla de los datos de Cloudinary y Prisma para máxima compatibilidad
      return {
        ...savedFile,
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url
      };
    } catch (e) {
      // 🔴 HACK/TEST: Fallback si la BD falla en dev
      return { 
        id: uploadResult.public_id || 'temporal-123',
        workspaceId,
        url: uploadResult.secure_url,
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        provider: FileProvider.CLOUDINARY,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  async findAll(workspaceId: string) {
    return this.prisma.file.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, workspaceId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id, workspaceId },
    });

    if (!file) throw new BadRequestException('Archivo no encontrado');

    // (Opcional MVP) Aquí se podría destruir la imagen en cloudinary también
    return this.prisma.file.delete({
      where: { id },
    });
  }
}
