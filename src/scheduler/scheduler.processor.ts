import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookAuthService } from '../social/facebook-auth.service';

@Processor('publish-post')
export class SchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookAuthService: FacebookAuthService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.debug(`Iniciando procesamiento del job #${job.id} (Tipo: ${job.name})`);
    const { scheduledPostId, workspaceId } = job.data;

    // 1. Obtener la data fresca del post programado
    const scheduledPost = await this.prisma.scheduledPost.findUnique({
      where: { id: scheduledPostId },
      include: {
        post: true,
        socialAccount: true,
      },
    });

    if (!scheduledPost) {
      this.logger.warn(`El ScheduledPost ${scheduledPostId} no se encontró en BD. Ignorando.`);
      return;
    }

    // 2. Marcar como PROCESSING
    await this.prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { status: 'PROCESSING' },
    });

    try {
      this.logger.log(`>> Publicando POST [${scheduledPost.post.title || 'Draft'}] en Workspace: ${workspaceId}`);
      this.logger.log(`>> Red Social Objetivo: ${scheduledPost.socialAccount.provider} (@${scheduledPost.socialAccount.username})`);

      // 3. Publicación Real
      await this.publishToSocialMedia(scheduledPost);

      // 4. Marcar como exitoso
      await this.prisma.scheduledPost.update({
        where: { id: scheduledPostId },
        data: { status: 'PUBLISHED' },
      });

      this.logger.log(`>> ¡Publicación exitosa! (${scheduledPostId})`);
    } catch (error) {
      this.logger.error(`Error publicando: ${error.message}`);

      // 5. Marcar como fallido en caso de error
      await this.prisma.scheduledPost.update({
        where: { id: scheduledPostId },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Unknown error'
        },
      });

      throw error;
    }
  }

  private async publishToSocialMedia(scheduledPost: any) {
    const { socialAccount, post } = scheduledPost;

    if (socialAccount.provider === 'INSTAGRAM') {
      // Usar el servicio inyectado para publicar
      await this.facebookAuthService.publishInstagramPost(
        socialAccount.providerAccountId,
        socialAccount.accessToken,
        post.imageUrl || post.content, // Asumiendo que tenemos una URL de imagen
        post.content
      );
    }
    // TODO: Otros providers
  }
}
