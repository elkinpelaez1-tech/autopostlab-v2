import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://autopostlab_db_n0ef_user:c72m03VOs0ZiEx3tO7TajYRUITAog8KT@dpg-d7ajjofkijhs73an3in0-a.oregon-postgres.render.com/autopostlab_db_n0ef&connection_limit=3&pool_timeout=10?sslmode=require"
    }
  }
});

async function main() {
  console.log('🧹 RESTORING FACEBOOK USERNAME TO NORMAL 🧹');
  
  const facebookAccount = await prisma.socialAccount.findFirst({
    where: { 
      provider: 'FACEBOOK', 
      workspaceId: 'cmovv834i00013o733pttr57u'
    }
  });

  if (facebookAccount) {
    const restored = await prisma.socialAccount.update({
      where: { id: facebookAccount.id },
      data: { username: "Central de Reservas y Turismo" } // Dropping the Canary tag
    });
    console.log(`✅ Successfully restored Facebook account username back to: "${restored.username}"`);
  } else {
    console.log("❌ Target Facebook account not found for restoration.");
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
