import { PrismaClient } from '@prisma/client';
// Using native global fetch

const prisma = new PrismaClient({
  datasources: {
    db: {
      // USING THE DEFINITIVE PRODUCTION URL FROM USER THAT REVEALED THE 2 ACTIVE ACCOUNTS!
      url: "postgresql://autopostlab_db_n0ef_user:c72m03VOs0ZiEx3tO7TajYRUITAog8KT@dpg-d7ajjofkijhs73an3in0-a.oregon-postgres.render.com/autopostlab_db_n0ef&connection_limit=3&pool_timeout=10?sslmode=require"
    }
  }
});

async function main() {
  console.log('🚀 INITIATING PRODUCTION REPAIR SCRIPT FOR INSTAGRAM 🚀');
  
  const targetWorkspaceId = "cmovv834i00013o733pttr57u";
  const targetOrganizationId = "f8e9e5d6-fcfa-4b95-98df-8f4096b11eae";
  
  // 1. Locate Facebook Page from THIS production database
  const fbPage = await prisma.socialAccount.findFirst({
    where: {
      provider: 'FACEBOOK',
      workspaceId: targetWorkspaceId
    }
  });

  if (!fbPage) {
    console.error("❌ Fatal Error: Could not locate Facebook account in the new production IDs.");
    return;
  }

  console.log(`✅ Found Facebook Page in PRODUCTION DB: ${fbPage.displayName} (ID: ${fbPage.providerAccountId})`);
  console.log(`🔑 Using Live Access Token: ${fbPage.accessToken.substring(0, 20)}...`);

  // 2. Call Meta Graph API directly to detect the associated Instagram Account
  const fields = 'id,name,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}';
  const url = `https://graph.facebook.com/v19.0/${fbPage.providerAccountId}?fields=${fields}&access_token=${fbPage.accessToken}`;
  
  console.log("📡 Fetching Instagram links from Meta...");
  const res = await fetch(url);
  const data: any = await res.json();

  if (data.error) {
    console.error("❌ Meta API Error:", JSON.stringify(data.error, null, 2));
    return;
  }

  const ig = data.instagram_business_account || data.connected_instagram_account;

  if (!ig) {
    console.error("❌ No Instagram account found linked to this page in Meta response.");
    console.log("DEBUG RESPONSE:", JSON.stringify(data, null, 2));
    return;
  }

  const igType = data.instagram_business_account ? 'instagram_business_account' : 'connected_instagram_account';
  console.log(`📸 Instagram Detected via ${igType}: ${ig.username} (${ig.id})`);

  // 3. Insert or Update the Instagram Account directly into THIS active database!
  const insertData = {
    provider: 'INSTAGRAM' as any,
    providerAccountId: ig.id,
    username: ig.username || `ig_${ig.id}`,
    displayName: ig.name || ig.username || "⛵Central de Reservas y Turismo",
    avatarUrl: ig.profile_picture_url || null,
    accessToken: fbPage.accessToken, // Use same live token
    status: 'ACTIVE' as any,
    workspaceId: targetWorkspaceId,
    organizationId: targetOrganizationId
  };

  console.log("💾 Upserting Instagram Account into PRODUCTION DB...");
  
  const existingIg = await prisma.socialAccount.findFirst({
    where: {
      provider: 'INSTAGRAM',
      providerAccountId: ig.id,
      workspaceId: targetWorkspaceId
    }
  });

  let finalResult;
  if (existingIg) {
    finalResult = await prisma.socialAccount.update({
      where: { id: existingIg.id },
      data: insertData
    });
    console.log(`✅ Instagram UPDATED successfully! Record ID: ${finalResult.id}`);
  } else {
    finalResult = await prisma.socialAccount.create({
      data: insertData
    });
    console.log(`✅ Instagram CREATED successfully! Record ID: ${finalResult.id}`);
  }

  // 4. Final Count Verification
  const finalCount = await prisma.socialAccount.count({
    where: { workspaceId: targetWorkspaceId }
  });
  console.log(`🎉 FINISHED! Total accounts in this workspace NOW: ${finalCount}`);
}

main()
  .catch(e => console.error("❌ Runtime failure:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
