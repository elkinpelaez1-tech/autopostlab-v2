import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { LinkedinAuthService } from '../social/linkedin-auth.service';
import { FacebookAuthService } from '../social/facebook-auth.service';
import { TikTokAuthService } from '../social/tiktok-auth.service';
import { SocialAccountsService } from '../social/social-accounts.service';
import { FilesService } from '../files/files.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private linkedinAuthService: LinkedinAuthService,
    private facebookAuthService: FacebookAuthService,
    private tiktokAuthService: TikTokAuthService,
    private socialAccountsService: SocialAccountsService,
    private filesService: FilesService,
  ) {}

  async create(workspaceId: string, organizationId: string, dto: CreatePostDto) {
    console.log("DEBUG: Datos recibidos para crear post:", JSON.stringify({ workspaceId, organizationId, dto }, null, 2));
    
    // 1. Crear el Post base en la base de datos (siempre se guarda)
    const post = await this.prisma.post.create({
      data: {
        workspaceId,
        organizationId,
        content: dto.content,
        title: dto.title,
        linkUrl: dto.linkUrl,
        isDraft: dto.isDraft ?? false,
        files: {
          create: (dto.fileIds || []).map((fileId, index) => ({
            fileId: fileId,
            order: index,
          })),
        },
      },
      include: {
        files: { include: { file: true } }
      }
    });

    // 🔴 BORRADOR: Si es un borrador, no procesamos cuentas ni programaciones
    if (dto.isDraft) {
      console.log("💾 GUARDANDO COMO BORRADOR. Omitiendo publicación.");
      return {
        success: true,
        message: "Borrador guardado exitosamente",
        status: 'DRAFT',
        postId: post.id,
        platforms: {}
      };
    }

    const executionResults: Record<string, { status: string; error?: string | null; providerId?: string | null; provider: string }> = {};
    const accountIds = dto.accountIds || [];
    
    // 2. Procesar cada cuenta seleccionada de forma independiente
    for (const accountId of accountIds) {
      const account = await this.socialAccountsService.findOne(accountId, workspaceId, organizationId);
      const provider = account.provider.toUpperCase();

      let status: 'PUBLISHED' | 'FAILED' | 'PENDING' = dto.publishNow ? 'PUBLISHED' : 'PENDING';
      let errorMessage: string | null = null;
      let providerPostId: string | null = null;

      if (dto.publishNow) {
        try {
          const imageUrl = post.files?.[0]?.file?.url;
          providerPostId = await this.executePublication(
            provider,
            account,
            dto.content,
            organizationId,
            imageUrl
          );
          
          console.log("PLATFORM RESULT:", provider, { success: true, id: providerPostId });
          executionResults[accountId] = { status: 'success', providerId: providerPostId, provider };
        } catch (error) {
          console.log("PLATFORM ERROR:", provider, error.message);
          status = 'FAILED';
          errorMessage = error.message;
          executionResults[accountId] = { status: 'error', error: errorMessage, provider };
        }
      }

      // 3. Crear el registro de ScheduledPost (historial o programación)
      await this.prisma.scheduledPost.create({
        data: {
          workspaceId,
          postId: post.id,
          socialAccountId: accountId,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
          status: status as any,
          errorMessage,
        }
      });
    }

    // 4. Calcular estado general de la respuesta
    const totalSelected = accountIds.length;
    const successes = Object.values(executionResults).filter(r => r.status === 'success').length;
    
    let finalStatus = 'PUBLISHED';
    let success = true;

    if (totalSelected > 0 && dto.publishNow) {
      if (successes === totalSelected) {
        finalStatus = 'PUBLISHED'; // SUCCESS
      } else if (successes > 0) {
        finalStatus = 'PARTIAL_SUCCESS'; // PARTIAL
      } else {
        finalStatus = 'FAILED'; // FAILED
        success = false;
      }
    }

    console.log("FINAL POST RESULT:", JSON.stringify(executionResults, null, 2));

    return {
      success,
      message: finalStatus === 'PUBLISHED' ? "Publicado exitosamente" : (finalStatus === 'FAILED' ? "Error en la publicación" : "Publicación finalizada con estados mixtos"),
      status: finalStatus,
      postId: post.id,
      platforms: executionResults
    };
  }

  // 🧱 MÉTODO INTERNO PARA PUBLICAR (Reutilizable)
  private async executePublication(provider: string, account: any, content: string, organizationId: string, imageUrl?: string) {
    provider = provider.toUpperCase();
    let finalImageUrl = imageUrl;

    // 🛡️ SUBIR A CLOUDINARY SI ES LOCAL
    if (imageUrl && !imageUrl.startsWith('http')) {
      try {
        console.log(`[DEBUG] Procesando imagen local para Cloudinary: ${imageUrl}`);
        // Si es un path local, intentamos leerlo
        const absolutePath = path.isAbsolute(imageUrl) ? imageUrl : path.join(process.cwd(), imageUrl);
        if (fs.existsSync(absolutePath)) {
          const buffer = fs.readFileSync(absolutePath);
          const ext = path.extname(absolutePath).substring(1) || 'png';
          finalImageUrl = await this.filesService.uploadFromBuffer(
            account.workspaceId, 
            buffer, 
            path.basename(absolutePath), 
            `image/${ext}`
          );
          console.log(`[DEBUG] Imagen local subida con éxito: ${finalImageUrl}`);
        }
      } catch (uploadError) {
        console.error("Error subiendo imagen local a Cloudinary:", uploadError);
      }
    }

    console.log(`[DEBUG] EXECUTE PUBLICATION - Provider: ${provider} | Content Length: ${content?.length} | Image: ${finalImageUrl?.substring(0, 50)}...`);
    if (provider === 'LINKEDIN') {
      const res = await this.linkedinAuthService.createPost(account.accessToken, account.providerAccountId, content, finalImageUrl);
      return res.id || JSON.stringify(res);
    } 
    else if (provider === 'FACEBOOK') {
      return await this.facebookAuthService.publishFacebookPost(account.providerAccountId, account.accessToken, content, finalImageUrl);
    }
    else if (provider === 'INSTAGRAM') {
      if (!finalImageUrl) throw new Error("IMAGE_REQUIRED");
      return await this.facebookAuthService.publishInstagramPost(account.providerAccountId, account.accessToken, finalImageUrl, content);
    }
    else if (provider === 'TIKTOK') {
      // 🛡️ REFRESH TOKEN AUTOMÁTICO PARA TIKTOK
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutos
      
      if (account.refreshToken && (!account.accessTokenExpires || now.getTime() + bufferTime > new Date(account.accessTokenExpires).getTime())) {
        try {
          console.log(`[TIKTOK] 🔑 Token expirado o por expirar para la cuenta ${account.username}. Refrescando...`);
          const newTokens = await this.tiktokAuthService.refreshToken(account.refreshToken);
          
          // Actualizar el objeto en memoria para la ejecución actual
          account.accessToken = newTokens.accessToken;
          
          // Persistir en base de datos para futuras publicaciones
          await this.socialAccountsService.update(account.id, {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            accessTokenExpires: newTokens.expiresAt
          }, account.workspaceId, organizationId);
          
          console.log("[TIKTOK] ✅ Token renovado y guardado en DB correctamente.");
        } catch (refreshError) {
          console.error("[TIKTOK] ❌ Error crítico al refrescar token:", refreshError.message);
          throw new Error("TIKTOK_SESSION_EXPIRED: Tu sesión de TikTok ha caducado y no se pudo renovar automáticamente. Por favor, desvincula y vuelve a vincular tu cuenta de TikTok.");
        }
      }

      if (!finalImageUrl) throw new Error("VIDEO_REQUIRED_FOR_TIKTOK");
      
      // 0. Validar requisitos de video (Básico)
      const lowercaseUrl = finalImageUrl.toLowerCase();
      if (!lowercaseUrl.endsWith('.mp4') && !lowercaseUrl.includes('video')) {
        throw new Error("TIKTOK_REQUIREMENT: Only .mp4 videos are officially supported for automated upload.");
      }

      // 1. Descargar el video
      console.log(`[TIKTOK] Descargando video de: ${finalImageUrl}`);
      if (!finalImageUrl) {
        throw new Error("imageUrl is required");
      }
      const videoBuffer = await this.downloadFile(finalImageUrl);
      
      // Validar tamaño (TikTok tiene límites, ej 50MB para este flujo simplificado)
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB
      if (videoBuffer.length > MAX_SIZE) {
        throw new Error(`VIDEO_TOO_LARGE: El video pesa ${Math.round(videoBuffer.length/1024/1024)}MB. El límite para este flujo es 50MB.`);
      }

      console.log(`[TIKTOK] ✅ Video listo (${videoBuffer.length} bytes). Iniciando flujo multi-step.`);

      try {
        console.log('USING INBOX FLOW ONLY');
        // 2. Inicializar upload con Inbox API (Drafts)
        console.log(`[TIKTOK] Intentando inicializar upload para INBOX (Drafts)...`);
        const initData = await this.tiktokAuthService.initializeInboxUpload(account.accessToken, videoBuffer.length, content);
        console.log(`[TIKTOK] 1/2 Init Inbox OK: publish_id=${initData.publish_id}, upload_url=${initData.upload_url}`);
        
        // 3. Subir archivo
        console.log(`[TIKTOK] 2/2 Subiendo bytes para Inbox... (Content-Length: ${videoBuffer.length})`);
        await this.tiktokAuthService.uploadVideoFile(initData.upload_url, videoBuffer);
        console.log(`[TIKTOK] 🚀 Upload binario completado. Video subido como borrador en el Inbox.`);

        return initData.publish_id;
      } catch (error) {
        console.log('TIKTOK ERROR FULL:', JSON.stringify(error.response?.data, null, 2));
        console.log('TIKTOK ERROR STATUS:', error.response?.status);
        console.log('TIKTOK ERROR HEADERS:', JSON.stringify(error.response?.headers, null, 2));
        throw error;
      }
    }
    throw new Error(`Proveedor ${provider} no soportado.`);
  }

  // 📥 Descargador de archivos para proveedores que requieren push_by_file (como TikTok)
  private async downloadFile(url: string): Promise<Buffer> {
    const axios = require('axios');
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  async findAllByWorkspace(workspaceId: string, organizationId: string) {
    if(!workspaceId || !organizationId) throw new Error("Workspace ID and Organization ID are required");
    return this.prisma.post.findMany({
      where: { workspaceId, organizationId },
      orderBy: { createdAt: 'desc' },
      include: { 
        scheduledPosts: {
          include: {
            socialAccount: true
          }
        },
        files: { include: { file: true } } 
      }
    });
  }

  async remove(id: string, workspaceId: string, organizationId: string) {
    // 1. Verificar pertenencia
    const post = await this.prisma.post.findFirst({ where: { id, workspaceId, organizationId } });
    if (!post) throw new Error("Post no encontrado o no pertenece al workspace");

    // 2. Eliminar programaciones manuales (si no hay cascade en schema)
    await this.prisma.scheduledPost.deleteMany({ where: { postId: id } });
    
    // 3. Eliminar archivos relacionados
    await this.prisma.postFile.deleteMany({ where: { postId: id } });

    // 4. Eliminar post base
    return this.prisma.post.delete({ where: { id } });
  }

  async updatePostContent(id: string, workspaceId: string, organizationId: string, content: string) {
    const post = await this.prisma.post.findFirst({ where: { id, workspaceId, organizationId } });
    if (!post) throw new Error("Post no encontrado");

    return this.prisma.post.update({
      where: { id },
      data: { content }
    });
  }

  async updateScheduledDate(scheduledId: string, workspaceId: string, organizationId: string, scheduledAt: string) {
    const sp = await this.prisma.scheduledPost.findFirst({
      where: { id: scheduledId, workspaceId } // Note: we should add organizationId if we added it to ScheduledPost, but let's keep it safe or we assume the post check is enough.
    });
    if (!sp) throw new Error("Programación no encontrada");

    return this.prisma.scheduledPost.update({
      where: { id: scheduledId },
      data: { 
        scheduledAt: new Date(scheduledAt),
        status: 'PENDING' // Al reprogramar, vuelve a pendiente si estaba en error
      }
    });
  }

  async publishScheduledPostNow(scheduledId: string, workspaceId: string, organizationId: string) {
    const sp = await this.prisma.scheduledPost.findFirst({
      where: { id: scheduledId, workspaceId },
      include: { 
        post: { include: { files: { include: { file: true } } } },
        socialAccount: true
      }
    });

    if (!sp) throw new Error("Programación no encontrada");

    try {
      const imageUrl = sp.post.files?.[0]?.file?.url;
      const providerPostId = await this.executePublication(
        sp.socialAccount.provider,
        sp.socialAccount,
        sp.post.content,
        imageUrl
      );

      return this.prisma.scheduledPost.update({
        where: { id: scheduledId },
        data: { 
            status: 'PUBLISHED',
            errorMessage: null
        }
      });
    } catch (error) {
      await this.prisma.scheduledPost.update({
        where: { id: scheduledId },
        data: { 
            status: 'FAILED',
            errorMessage: error.message
        }
      });
      throw error;
    }
  }
}
