import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const accs = await prisma.socialAccount.findMany({
    include: { workspace: true }
  });

  console.log('--- RESUMEN DE CUENTAS ---');
  accs.forEach(a => {
    console.log(`[${a.provider}] ID: ${a.id} | Workspace: ${a.workspace.name} (${a.workspaceId}) | Status: ${a.status}`);
  });
  console.log('--- FIN RESUMEN ---');

  const workspaces = await prisma.workspace.findMany();
  console.log('\n--- WORKSPACES EXISTENTES ---');
  workspaces.forEach(w => console.log(`${w.name} (${w.id})`));

  await prisma.$disconnect();
}

check();
