import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { SchedulerProcessor } from './scheduler.processor';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsModule } from '../social/social-accounts.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'publish-post',
    }),
    SocialAccountsModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerProcessor, PrismaService],
})
export class SchedulerModule { }
