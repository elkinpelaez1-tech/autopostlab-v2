import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const failedPosts = await prisma.scheduledPost.findMany({
    where: { status: 'FAILED' },
    orderBy: { scheduledAt: 'desc' },
    take: 5,
    include: {
      socialAccount: true,
      post: true
    }
  });

  console.log('--- ÚLTIMOS FALLOS DE PUBLICACIÓN ---');
  failedPosts.forEach((sp, i) => {
    console.log(`${i+1}. [${sp.socialAccount.provider}] Error: ${sp.errorMessage}`);
    console.log(`   Fecha: ${sp.scheduledAt}`);
    console.log(`   Post ID: ${sp.postId}`);
    console.log('------------------------------------');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
