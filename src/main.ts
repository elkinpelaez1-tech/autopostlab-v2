import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('ENV CHECK:', {
    client: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect: process.env.GOOGLE_REDIRECT_URI
  });
  const app = await NestFactory.create(AppModule);

  // Global Logger Middleware
  app.use((req, res, next) => {
    console.log(`[GLOBAL MW] ${req.method} ${req.originalUrl || req.url}`);
    next();
  });

  app.enableCors({
    origin: [
      "https://autopostlab-v2.vercel.app"
    ],
    credentials: true
  });


  // 🛠 Activar prefijo global /api
  app.setGlobalPrefix('api');

  app.useGlobalPipes(

    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log('APP RUNNING ON PORT', port);

}
bootstrap();
