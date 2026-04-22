
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workspaceId = 'cmnuexlk30001lfyk0m7420w9'; // Asesor comercial WS
  const accountIds = ['cmnqafheq000vzy083at3fyxi']; // Elkin's Instagram account ID (MOCKING THE MISMATCH)
  const content = 'Test post from script';
  const scheduledAt = new Date().toISOString();

  console.log(`Attempting to create post for workspace: ${workspaceId}`);
  
  try {
    const postData: any = {
      workspaceId,
      content,
      isDraft: false,
    };

    postData.scheduledPosts = {
      create: accountIds.map((accountId) => ({
        workspaceId,
        socialAccountId: accountId,
        scheduledAt: new Date(scheduledAt),
        status: 'PENDING',
      })),
    };

    const result = await prisma.post.create({
      data: postData,
      include: {
        scheduledPosts: true,
      },
    });

    console.log('✅ Success:', result.id);
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.meta) console.error('Error Meta:', error.meta);
  }
}

main().finally(() => prisma.$disconnect());
