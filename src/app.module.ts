import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SocialAccountsModule as SocialAuthModule } from './social/social-accounts.module';
import { PostsModule } from './posts/posts.module';
import { FilesModule } from './files/files.module';
import { BillingModule } from './billing/billing.module';
// import { SchedulerModule } from './scheduler/scheduler.module';
import { PrismaModule } from './prisma/prisma.module';
import { AnalyticsModule } from './analytics/analytics.module';
import * as fs from 'fs';

import { UploadController } from './upload.controller';



@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SocialAuthModule,
    PostsModule,
    FilesModule,
    BillingModule,
    AnalyticsModule,
  ],
  controllers: [AppController, UploadController],
  providers: [
    AppService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req, res, next) => {
        const logEntry = `[HTTP_TRACE] ${req.method} ${req.url} - Body: ${JSON.stringify(req.body)}`;
        console.log(logEntry);
        next();
      })
      .forRoutes('*');
  }
}


