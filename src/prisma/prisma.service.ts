import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('Database connected successfully.');
        break;
      } catch (error) {
        retries--;
        this.logger.error(`Database connection failed. Retrying... (${retries} retries left). Error: ${error.message}`);
        if (retries === 0) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
}
