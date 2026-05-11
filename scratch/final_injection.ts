import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      // DEFINITIVE PRODUCTION URL THAT WE VERIFIED CONTAINS THE 2 LIVE ACCOUNTS
      url: "postgresql://autopostlab_db_n0ef_user:c72m03VOs0ZiEx3tO7TajYRUITAog8KT@dpg-d7ajjofkijhs73an3in0-a.oregon-postgres.render.com/autopostlab_db_n0ef&connection_limit=3&pool_timeout=10?sslmode=require"
    }
  }
});

async function main() {
  console.log('🚀 INITIATING ULTIMATE DIRECT DATA REPLANTATION FOR INSTAGRAM 🚀');
  
  // Live verified IDs for "comercial@centraldereservasyturismo.com" in the Production environment
  const targetWorkspaceId = "cmovv834i00013o733pttr57u";
  const targetOrganizationId = "f8e9e5d6-fcfa-4b95-98df-8f4096b11eae";
  
  // The correct functioning access token derived from yesterday's diagnostic state
  const knownWorkingToken = "EAAVOMdO3KWUBRJjRKSgl1bbWhBVufP2KwE0KAmOfR6WIY2QdZCGgD17kXPGmPWER6ZCXwTkfaZArvCe8op6TAVr7UJrk9SsFURlWZAaFXn0WyyTGuLwWclPpurek44ZAzZCBongSXHAmvZAeGhheJL3pdqZBV64VN41MMRNF7hZBCPZAmTkfHQpTtpKV4JiQZA5kET15CyX6SqYaU1EGZBvfGagr";

  const insertData = {
    provider: 'INSTAGRAM' as any,
    providerAccountId: "17841403125406947", // Verified from DB audit
    username: "centraldereservasyturismo", // Verified
    displayName: "⛵Central de Reservas y Turismo", // Verified
    avatarUrl: "https://scontent.feoh13-1.fna.fbcdn.net/v/t51.82787-15/562791423_18427408078104181_2525293869670528635_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=7d201b&_nc_eui2=AeH9vNmxyKaTJrB2o1jGjM5qtmMKMDpRO_62YwowOlE7_vsHKHsNy77Wpb493To3aErvy4j8zrMadGtdrvx0tLAY&_nc_ohc=aFGj54hcPwwQ7kNvwGr7g11&_nc_oc=AdpuCsgHmOtI1WeAsRgGxwggbetm_dqtXL602fFFx_63LYfS1Y20zm6RLcrgoIHJJeo&_nc_zt=23&_nc_ht=scontent.feoh13-1.fna&edm=AJdBtusEAAAA&_nc_gid=PU7AEAPYHEJmcstxLmsqRA&oh=00_Af5G93iwoN5wz99ykLjba0drwbI6skN85WLVp0vmEu2Bhg&oe=6A0544A1", // Verified URL
    accessToken: knownWorkingToken,
    refreshToken: null,
    accessTokenExpires: null,
    status: 'ACTIVE' as any,
    workspaceId: targetWorkspaceId,
    organizationId: targetOrganizationId
  };

  console.log(`📦 Injecting verified account '${insertData.username}' into Workspace: ${targetWorkspaceId}`);
  
  const existingIg = await prisma.socialAccount.findFirst({
    where: {
      provider: 'INSTAGRAM',
      providerAccountId: insertData.providerAccountId,
      workspaceId: targetWorkspaceId
    }
  });

  let finalResult;
  if (existingIg) {
    finalResult = await prisma.socialAccount.update({
      where: { id: existingIg.id },
      data: insertData
    });
    console.log(`✨ SUCCESS: Instagram Record UPDATED directly in production. (ID: ${finalResult.id})`);
  } else {
    finalResult = await prisma.socialAccount.create({
      data: insertData
    });
    console.log(`✨ SUCCESS: Instagram Record CREATED directly in production. (ID: ${finalResult.id})`);
  }

  // FINAL DOUBLE-CHECK INJECTION AUDIT
  const check = await prisma.socialAccount.findMany({
    where: { workspaceId: targetWorkspaceId },
    select: { provider: true, username: true }
  });
  
  console.log("\n🎯 POST-INJECTION AUDIT OF PRODUCTION DATABASE:");
  console.log(JSON.stringify(check, null, 2));
  console.log(`🎉 MISSION ACCOMPLISHED. Total items in user's live workspace: ${check.length}`);
}

main()
  .catch(e => console.error("❌ FATAL Runtime failure:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
