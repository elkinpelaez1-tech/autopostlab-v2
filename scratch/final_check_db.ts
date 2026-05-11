import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://autopostlab_db_n0ef_user:c72m03VOs0ZiEx3tO7TajYRUITAog8KT@dpg-d7ajjofkijhs73an3in0-a.oregon-postgres.render.com/autopostlab_db_n0ef&connection_limit=3&pool_timeout=10?sslmode=require"
    }
  }
});

async function main() {
  const fb = await prisma.socialAccount.findFirst({
    where: { provider: 'FACEBOOK', workspaceId: 'cmovv834i00013o733pttr57u' },
    select: { username: true, displayName: true }
  });
  console.log("✅ [DB STATE] Facebook Identity:", JSON.stringify(fb, null, 2));
}

main().finally(() => prisma.$disconnect());
