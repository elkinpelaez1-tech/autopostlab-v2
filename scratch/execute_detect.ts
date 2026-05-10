import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workspaceId = 'cmnuexlk30001lfyk0m7420w9';
  console.log(`🔍 [INTERNAL DETECT] Starting Instagram detection for workspace: ${workspaceId}`);

  // 1. Fetch active FB accounts
  const fbPages = await prisma.socialAccount.findMany({
    where: {
      workspaceId,
      provider: 'FACEBOOK',
      status: 'ACTIVE',
    },
  });

  console.log(`📌 Found ${fbPages.length} active Facebook page(s) in DB.`);

  for (const page of fbPages) {
    console.log(`\n--------------------------------------------`);
    console.log(`Page: ${page.displayName} (ID: ${page.providerAccountId})`);
    
    const fields = 'id,name,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}';
    const url = `https://graph.facebook.com/v19.0/${page.providerAccountId}?fields=${fields}&access_token=${page.accessToken}`;
    
    try {
      const response = await fetch(url);
      const data: any = await response.json();
      
      console.log('📄 Meta response:', JSON.stringify(data, null, 2));

      if (data.error) {
        console.error('❌ Meta API Error:', data.error);
        continue;
      }

      const ig = data.instagram_business_account || data.connected_instagram_account;
      if (ig) {
        const type = data.instagram_business_account ? 'instagram_business_account' : 'connected_instagram_account';
        console.log(`✨ Instagram account detected via ${type}: ${ig.username} (${ig.id})`);

        // Perform upsert
        const existing = await prisma.socialAccount.findFirst({
          where: {
            workspaceId,
            provider: 'INSTAGRAM',
            providerAccountId: ig.id,
          },
        });

        console.log('🟢 [IG DETECTION] Intentando guardar IG:', JSON.stringify({ id: ig.id, username: ig.username, workspaceId, organizationId: page.organizationId }));

        if (existing) {
          console.log(`🔄 Updating existing Instagram account in DB (ID: ${existing.id})`);
          const updated = await prisma.socialAccount.update({
            where: { id: existing.id },
            data: {
              username: ig.username || existing.username,
              displayName: ig.name || ig.username || existing.displayName,
              avatarUrl: ig.profile_picture_url || existing.avatarUrl,
              accessToken: page.accessToken,
              status: 'ACTIVE',
            },
          });
          console.log('🟢 [IG DETECTION] Guardado exitoso:', JSON.stringify(updated));
        } else {
          console.log(`🆕 Creating new Instagram account in DB`);
          const created = await prisma.socialAccount.create({
            data: {
              workspaceId,
              organizationId: page.organizationId,
              provider: 'INSTAGRAM',
              providerAccountId: ig.id,
              username: ig.username || `ig_${ig.id}`,
              displayName: ig.name || ig.username || `${page.displayName} (Instagram)`,
              avatarUrl: ig.profile_picture_url || null,
              accessToken: page.accessToken,
              status: 'ACTIVE',
            },
          });
          console.log('🟢 [IG DETECTION] Guardado exitoso:', JSON.stringify(created));
        }
      } else {
        console.log('⚠️ No Instagram account connected to this page.');
      }
    } catch (err) {
      console.error('❌ Fetch / DB error:', err);
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
