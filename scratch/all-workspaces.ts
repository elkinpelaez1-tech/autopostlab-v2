
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ALL WORKSPACES AND THEIR ACCOUNTS ---');
  const workspaces = await prisma.workspace.findMany({
    include: {
      socialAccounts: true,
      owner: {
        select: {
          email: true,
          name: true
        }
      }
    }
  });
  console.log(JSON.stringify(workspaces, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
