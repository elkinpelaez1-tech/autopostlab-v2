import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Logger Middleware
  app.use((req, res, next) => {
    console.log(`[GLOBAL MW] ${req.method} ${req.originalUrl || req.url}`);
    next();
  });

  // 🌍 Habilitar CORS para conectar con el frontend (puerto 3000)
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
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
