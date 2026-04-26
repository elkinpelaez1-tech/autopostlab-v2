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
    if (!file.buffer) throw new BadRequestException('El archivo no contiene datos (buffer vacío)');

    console.log(`[FILES_SERVICE] 1. Iniciando subida a Cloudinary... (Workspace: ${workspaceId})`);

    let uploadResult;
    try {
      uploadResult = await new Promise<any>((resolve, reject) => {
        // Timeout de 30 segundos para evitar que la petición se quede colgada
        const timer = setTimeout(() => {
          reject(new Error('Tiempo de espera agotado al conectar con Cloudinary (30s)'));
        }, 30000);

        const uploadStream = cloudinary.uploader.upload_stream(
          { 
            folder: `autopostlab/${workspaceId}`,
            resource_type: 'auto',
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          },
          (error, result) => {
            clearTimeout(timer);
            if (error) {
              console.error("[CLOUDINARY_CALLBACK_ERROR]:", error);
              return reject(error);
            }
            resolve(result);
          },
        );

        uploadStream.end(file.buffer);
      });
      
      console.log(`[FILES_SERVICE] 2. Cloudinary subida exitosa. Guardando en DB...`);
    } catch (cloudinaryError) {
      console.error("🔥 Error desde Cloudinary:", cloudinaryError);
      throw new BadRequestException(
        `Fallo en Cloudinary: ${cloudinaryError.message || 'Error de conexión'}`
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
      console.log(`[FILES_SERVICE] 3. Registro en DB completado (ID: ${savedFile.id})`);
      return {
        ...savedFile,
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url
      };
    } catch (dbError) {
      console.warn(`[FILES_SERVICE] Advertencia: Error al guardar en DB, usando fallback:`, dbError.message);
      return { 
        id: uploadResult.public_id || 'temporal-' + Date.now(),
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
