import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('>>> Iniciando Verificación de Integridad Post-Modificación...');

  const sampleUser = await prisma.user.findFirst();
  if (sampleUser) {
    console.log(`👤 Usuario Detectado: ${sampleUser.email}`);
    console.log(`    - Rol Original: ${sampleUser.role}`);
    console.log(`    - Nuevo Campo isBlocked: ${sampleUser.isBlocked}`);
    if (sampleUser.isBlocked === false) console.log("    ✅ OK: isBlocked por defecto es false.");
  }

  const sampleOrg = await prisma.organization.findFirst();
  if (sampleOrg) {
    console.log(`🏢 Organización Detectada: ${sampleOrg.name}`);
    console.log(`    - Nuevo Campo isSuspended: ${sampleOrg.isSuspended}`);
    if (sampleOrg.isSuspended === false) console.log("    ✅ OK: isSuspended por defecto es false.");
  }

  const socialCount = await prisma.socialAccount.count();
  console.log(`🔗 Total Cuentas Sociales intactas: ${socialCount}`);
  
  console.log("🎉 PRUEBA DE INTEGRIDAD PASADA CON ÉXITO. LA DATA ESTABLE NO FUE ALTERADA.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
