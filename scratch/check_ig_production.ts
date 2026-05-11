import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://autopostlab_db_n0ef_user:c72m03VOs0ZiEx3tO7TajYRUITAog8KT@dpg-d7ajjofkijhs73an3in0-a.oregon-postgres.render.com/autopostlab_db_n0ef&connection_limit=3&pool_timeout=10?sslmode=require"
    }
  }
});

async function main() {
  console.log('🔍 [DB AUDIT] Querying SocialAccount table for provider = INSTAGRAM...');
  const allAccounts = await prisma.socialAccount.findMany();
  
  console.log(`📊 Total accounts in DB: ${allAccounts.length}`);
  console.log("FULL ACCOUNTS DUMP:");
  console.log(JSON.stringify(allAccounts, null, 2));

  const allUsers = await prisma.user.findMany({
    select: { 
      id: true, 
      email: true, 
      organizationId: true,
      ownedWorkspaces: {
        select: { id: true, name: true }
      }
    }
  });
  console.log("\n👥 USERS IN DB:");
  console.log(JSON.stringify(allUsers, null, 2));

  console.log("\n🧪 EXECUTING CANARY TEST: Updating Facebook username to check DB linking...");
  const facebookAccount = await prisma.socialAccount.findFirst({
    where: { provider: 'FACEBOOK', workspaceId: 'cmnuexlk30001lfyk0m7420w9' }
  });

  if (facebookAccount) {
    const originalName = facebookAccount.username;
    const updated = await prisma.socialAccount.update({
      where: { id: facebookAccount.id },
      data: { username: "Central de Reservas y Turismo [CANARY]" }
    });
    console.log(`✅ Successfully updated ${facebookAccount.id}.`);
    console.log(`   Before: "${originalName}"`);
    console.log(`   After:  "${updated.username}"`);
    console.log("\n⚠️ INSTRUCTION: Refresh frontend now. If Facebook shows [CANARY], it is the SAME DB. If not, Render is hitting another database!");
  } else {
    console.log("❌ Could not find the target Facebook account for Canary update.");
  }
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
