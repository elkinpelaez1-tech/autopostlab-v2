import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_WORKSPACE_ID = 'cmnp6v4dx0001oo7e297rkm9l';
const NEW_WORKSPACE_ID = 'cmnuexlk30001lfyk0m7420w9'; // Asesor comercial active

async function migrate() {
  console.log(`🚀 Iniciando migración de ${OLD_WORKSPACE_ID} a ${NEW_WORKSPACE_ID}...`);

  try {
    // 1. Migrar SocialAccounts
    const accounts = await prisma.socialAccount.updateMany({
      where: { workspaceId: OLD_WORKSPACE_ID },
      data: { workspaceId: NEW_WORKSPACE_ID }
    });
    console.log(`✅ Cuentas sociales migradas: ${accounts.count}`);

    // 2. Migrar Posts
    const posts = await prisma.post.updateMany({
      where: { workspaceId: OLD_WORKSPACE_ID },
      data: { workspaceId: NEW_WORKSPACE_ID }
    });
    console.log(`✅ Posts migrados: ${posts.count}`);

    // 3. Migrar ScheduledPosts
    const scheduled = await prisma.scheduledPost.updateMany({
      where: { workspaceId: OLD_WORKSPACE_ID },
      data: { workspaceId: NEW_WORKSPACE_ID }
    });
    console.log(`✅ Programaciones migradas: ${scheduled.count}`);

    // 4. Migrar Files
    const files = await prisma.file.updateMany({
      where: { workspaceId: OLD_WORKSPACE_ID },
      data: { workspaceId: NEW_WORKSPACE_ID }
    });
    console.log(`✅ Archivos migrados: ${files.count}`);

    console.log('🎉 Migración completada exitosamente.');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
