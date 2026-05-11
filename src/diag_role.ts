import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'elkinpelaez1@gmail.com' },
    });
    console.log('--- DIAGNOSTIC DUMP ---');
    console.log('User Found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('Email:', user.email);
      console.log('Current Role In DB:', user.role);
      console.log('Raw Object Structure Keys:', Object.keys(user));
    }
  } catch (error) {
    console.error('Error querying db:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
