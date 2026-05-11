import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from './posts.service';

@Injectable()
export class PostsCronService {
  private readonly logger = new Logger(PostsCronService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly postsService: PostsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPosts() {
    // Prevent overlap if processing takes more than 1 minute
    if (this.isProcessing) {
      this.logger.debug('Skipping cron cycle: previous cycle still running.');
      return;
    }

    this.isProcessing = true;
    try {
      const now = new Date();

      // 1. Fetch pending posts that should have been published by now
      const pendingPosts = await this.prisma.scheduledPost.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: {
            lte: now,
          },
        },
        include: {
          post: true,
          socialAccount: true,
        },
      });

      if (pendingPosts.length === 0) {
        return;
      }

      this.logger.log(`Found ${pendingPosts.length} scheduled post(s) ready for publication.`);

      for (const sp of pendingPosts) {
        try {
          // 2. Double check/Lock state to PROCESSING atomically
          const lockedPost = await this.prisma.scheduledPost.updateMany({
            where: {
              id: sp.id,
              status: 'PENDING', // concurrency safety check
            },
            data: {
              status: 'PROCESSING',
            },
          });

          if (lockedPost.count === 0) {
            // Already picked up by another process or manual click
            continue;
          }

          this.logger.log(`[CRON] Processing ScheduledPost ID ${sp.id} for Workspace ${sp.workspaceId}`);

          // 3. Extract organizationId from relationships
          const orgId = sp.post.organizationId || sp.socialAccount.organizationId;
          
          if (!orgId) {
             // Fallback mechanism if it's somehow missing, fetch from workspace owner? 
             // For now throw warning
             this.logger.warn(`[CRON] Cannot process ${sp.id}: organizationId missing in data graph.`);
             await this.prisma.scheduledPost.update({
               where: { id: sp.id },
               data: { status: 'FAILED', errorMessage: 'Missing organizationId context.' }
             });
             continue;
          }

          // 4. Execute real publication
          await this.postsService.publishScheduledPostNow(sp.id, sp.workspaceId, orgId);
          
          this.logger.log(`[CRON] Successfully executed ScheduledPost ID ${sp.id}`);
          
        } catch (error) {
          this.logger.error(`[CRON] Failed to execute ScheduledPost ID ${sp.id}: ${error.message}`);
          // PostsService.publishScheduledPostNow already updates status to FAILED internally on errors.
          // But we do an emergency fallback update just in case the crash happened outside try/catch of service.
          try {
            const check = await this.prisma.scheduledPost.findUnique({ where: { id: sp.id } });
            if (check && check.status === 'PROCESSING') {
               await this.prisma.scheduledPost.update({
                 where: { id: sp.id },
                 data: { status: 'FAILED', errorMessage: `CRON CRASH: ${error.message}` }
               });
            }
          } catch (dbErr) {
             this.logger.error(`[CRON] Fatal DB update error: ${dbErr.message}`);
          }
        }
      }
    } catch (fatalErr) {
      this.logger.error(`[CRON] Fatal error in main scheduler loop: ${fatalErr.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
