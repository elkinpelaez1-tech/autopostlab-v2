import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const backupDir = path.join(__dirname, '../scratch/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const ts = Date.now();
  
  console.log('>>> Iniciando Backup Lógico Seguro antes de Alter SQL...');
  
  const orgs = await prisma.organization.findMany();
  fs.writeFileSync(path.join(backupDir, `orgs_${ts}.json`), JSON.stringify(orgs, null, 2));
  console.log(`✅ ${orgs.length} Organizaciones respaldadas.`);

  const users = await prisma.user.findMany();
  fs.writeFileSync(path.join(backupDir, `users_${ts}.json`), JSON.stringify(users, null, 2));
  console.log(`✅ ${users.length} Usuarios respaldados.`);

  const social = await prisma.socialAccount.findMany();
  fs.writeFileSync(path.join(backupDir, `social_${ts}.json`), JSON.stringify(social, null, 2));
  console.log(`✅ ${social.length} Cuentas Sociales respaldadas.`);
  
  console.log('🎉 Backup completado satisfactoriamente.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
