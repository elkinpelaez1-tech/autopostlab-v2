import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('--- DIAGNÓSTICO FINAL ---');
  
  const user = await prisma.user.findFirst({
    where: { email: 'comercial@centraldereservasyturismo.com' },
    include: { ownedWorkspaces: true }
  });

  if (!user) {
    console.log('❌ Usuario No Encontrado');
    return;
  }

  const workspace = user.ownedWorkspaces[0];
  console.log(`👤 Usuario: ${user.email} (ID: ${user.id})`);
  console.log(`📁 Workspace Activo: ${workspace?.name} (ID: ${workspace?.id})`);

  const accounts = await prisma.socialAccount.findMany({
    include: { workspace: true }
  });

  console.log('\n📱 TODAS LAS CUENTAS EN LA DB:');
  accounts.forEach(a => {
    console.log(`   - [${a.provider}] ${a.username} | Workspace: ${a.workspaceId} (${a.workspace.name === workspace?.name ? 'MATCH' : 'MISMATCH'})`);
  });

  const countsByProvider = await prisma.socialAccount.groupBy({
    by: ['provider'],
    _count: true
  });
  console.log('\n📊 Conteo por Provider:', JSON.stringify(countsByProvider, null, 2));

  await prisma.$disconnect();
}

run();
