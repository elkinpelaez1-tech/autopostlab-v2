import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PostsCronService } from './posts.cron';

import { SocialAccountsModule } from '../social/social-accounts.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [SocialAccountsModule, FilesModule],
  controllers: [PostsController],
  providers: [PostsService, PostsCronService],
  exports: [PostsService],
})
export class PostsModule {}
