import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAuthController } from './social-auth.controller';
import { TikTokController } from './tiktok.controller';
import { SocialAccountsService } from './social-accounts.service';
import { FacebookAuthService } from './facebook-auth.service';
import { LinkedinAuthService } from './linkedin-auth.service';
import { TikTokAuthService } from './tiktok-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [SocialAccountsController, SocialAuthController, TikTokController],
  providers: [SocialAccountsService, FacebookAuthService, LinkedinAuthService, TikTokAuthService, PrismaService],
  exports: [SocialAccountsService, FacebookAuthService, LinkedinAuthService, TikTokAuthService],
})
export class SocialAccountsModule { }

