import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetEmail = 'elkinpelaez1@gmail.com';
  console.log(`>>> Iniciando Promoción Segura a SUPER_ADMIN para: ${targetEmail}`);

  const user = await prisma.user.findUnique({
    where: { email: targetEmail }
  });

  if (!user) {
    console.error('❌ ERROR: Usuario no encontrado en la base de datos. Verifica el correo.');
    process.exit(1);
  }

  console.log(`✅ Usuario encontrado. Rol actual: ${user.role}`);
  
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: 'SUPER_ADMIN' as any // Cast dynamic override
    }
  });

  console.log(`🎉 ÉXITO: El usuario ha sido promovido. Nuevo Rol: ${updatedUser.role}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
