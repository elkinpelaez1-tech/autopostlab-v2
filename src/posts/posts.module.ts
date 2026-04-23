import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

import { SocialAccountsModule } from '../social/social-accounts.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [SocialAccountsModule, FilesModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
