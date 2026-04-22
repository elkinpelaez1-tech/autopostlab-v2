
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simulateTikTokAuth() {
  const workspaceId = 'cmnuexlk30001lfyk0m7420w9'; // Elkin Pelaez Workspace
  const mockTikTokData = {
    provider: 'TIKTOK',
    providerAccountId: 'tiktok_user_12345',
    username: 'autopostlab_test',
    displayName: 'AutopostLab Test Account',
    avatarUrl: 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7342837492.webp',
    accessToken: 'mock_access_token_v2_fase1',
    refreshToken: 'mock_refresh_token_v2_fase1',
    expiresIn: 86400, // 24 horas
  };

  const expiresAt = new Date(Date.now() + mockTikTokData.expiresIn * 1000);

  console.log('--- SIMULACIÓN DE PERSISTENCIA TIKTOK ---');
  console.log(`Paso 1: Buscando cuenta existente para usuario ${mockTikTokData.providerAccountId} en workspace ${workspaceId}...`);

  // Lógica manual de Upsert (imitando exactamente el SocialAccountsService)
  let existing = await prisma.socialAccount.findFirst({
    where: {
      workspaceId,
      provider: 'TIKTOK' as any,
      providerAccountId: mockTikTokData.providerAccountId,
    },
  });

  let result;
  if (existing) {
    console.log(`🔄 Cuenta encontrada (ID: ${existing.id}). Actualizando...`);
    result = await prisma.socialAccount.update({
      where: { id: existing.id },
      data: {
        username: mockTikTokData.username,
        displayName: mockTikTokData.displayName,
        avatarUrl: mockTikTokData.avatarUrl,
        accessToken: mockTikTokData.accessToken,
        refreshToken: mockTikTokData.refreshToken,
        accessTokenExpires: expiresAt,
        status: 'ACTIVE',
      },
    });
  } else {
    console.log('✨ No se encontró cuenta previa. Creando nuevo registro...');
    result = await prisma.socialAccount.create({
      data: {
        workspaceId,
        provider: 'TIKTOK' as any,
        providerAccountId: mockTikTokData.providerAccountId,
        username: mockTikTokData.username,
        displayName: mockTikTokData.displayName,
        avatarUrl: mockTikTokData.avatarUrl,
        accessToken: mockTikTokData.accessToken,
        refreshToken: mockTikTokData.refreshToken,
        accessTokenExpires: expiresAt,
        status: 'ACTIVE',
      },
    });
  }

  console.log('✅ persistencia completada.');
  console.log('Datos guardados:', {
    id: result.id,
    provider: result.provider,
    username: result.username,
    expiresAt: result.accessTokenExpires,
  });

  // Paso 2: Probar Upsert (Actualización forzada)
  console.log('\n--- PROBANDO ACTUALIZACIÓN (SEGUNDA CONEXIÓN) ---');
  const updatedUsername = 'autopostlab_test_REFRESHED';
  
  const updatedAccount = await prisma.socialAccount.update({
    where: {
      id: result.id,
    },
    data: {
      username: updatedUsername,
    },
  });

  console.log(`✅ Actualización verificada. Username cambiado a: ${updatedAccount.username}`);
  console.log(`ID sigue siendo el mismo: ${result.id === updatedAccount.id}`);
}

simulateTikTokAuth()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
