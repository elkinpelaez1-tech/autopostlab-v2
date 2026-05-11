import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      // USING THE "&" PRODUCTION URL CONFIRMED AS ACTIVE IN YOUR NUBER
      url: "postgresql://autopostlab_db_n0ef_user:c72m03VOs0ZiEx3tO7TajYRUITAog8KT@dpg-d7ajjofkijhs73an3in0-a.oregon-postgres.render.com/autopostlab_db_n0ef&connection_limit=3&pool_timeout=10?sslmode=require"
    }
  }
});

async function main() {
  console.log('🧪 EXECUTING CANARY TEST ON PRODUCTION DB 🧪');
  
  const facebookAccount = await prisma.socialAccount.findFirst({
    where: { 
      provider: 'FACEBOOK', 
      workspaceId: 'cmovv834i00013o733pttr57u' // The ID discovered inside the real DB
    }
  });

  if (facebookAccount) {
    const updated = await prisma.socialAccount.update({
      where: { id: facebookAccount.id },
      data: { username: "Central de Reservas y Turismo [CANARY REAL]" }
    });
    console.log(`✅ Successfully updated Facebook account ${facebookAccount.id} in the production database!`);
    console.log(`   New Username in Subtitle: "${updated.username}"`);
  } else {
    console.log("❌ Could not locate Facebook account for canary update.");
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
