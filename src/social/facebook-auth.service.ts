import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InstagramAccount {
  pageName: string;
  pageAccessToken: string;
  instagramId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

@Injectable()
export class FacebookAuthService {
  private readonly logger = new Logger(FacebookAuthService.name);

  constructor(private configService: ConfigService) { }

  getAuthorizationUrl(workspaceId: string) {
    let appId = this.configService.get<string>('FB_APP_ID') || '';
    let redirectUri = this.configService.get<string>('FB_REDIRECT_URI') || '';
    const state = workspaceId || Date.now();

    // Limpiar comillas innecesarias que puedan venir del .env o de Render
    const rawAppId = appId;
    const rawRedirectUri = redirectUri;
    appId = appId.trim().replace(/^["']|["']$/g, '');
    redirectUri = redirectUri.trim().replace(/^["']|["']$/g, '');
    
    // 🔑 SCOPES COMPLETOS PARA ASEGURAR VISIBILIDAD DE PÁGINAS E INSTAGRAM
    const scope = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
      "public_profile",
      "email"
    ].join(",");

    // ✅ CONSTRUCCIÓN DIRECTA CON auth_type=rerequest PARA FORZAR PERMISOS
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&auth_type=rerequest`;

    console.log("---------------- [FACEBOOK OAUTH DEBUG] ----------------");
    console.log("FB_APP_ID Crudo (Env):", JSON.stringify(rawAppId));
    console.log("FB_APP_ID Limpio usado:", JSON.stringify(appId));
    console.log("FB_APP_ID Longitud:", appId.length);
    console.log("FB_REDIRECT_URI Crudo (Env):", JSON.stringify(rawRedirectUri));
    console.log("FB_REDIRECT_URI Limpio usado:", JSON.stringify(redirectUri));
    console.log("FACEBOOK SCOPES:", scope);
    console.log("FACEBOOK AUTH URL GENERADA:", authUrl);
    console.log("--------------------------------------------------------");

    return authUrl;
  }

  async exchangeCodeForToken(code: string, overrideRedirectUri?: string) {
    let appId = this.configService.get<string>('FB_APP_ID') || '';
    let appSecret = this.configService.get<string>('FB_APP_SECRET') || '';
    let redirectUri = overrideRedirectUri || this.configService.get<string>('FB_REDIRECT_URI') || '';

    appId = appId.trim().replace(/^["']|["']$/g, '');
    appSecret = appSecret.trim().replace(/^["']|["']$/g, '');
    redirectUri = redirectUri.trim().replace(/^["']|["']$/g, '');

    const url = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${appSecret}&code=${code}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      this.logger.error('Error intercambiando código:', data.error);
      throw new Error(data.error.message);
    }

    return data.access_token;
  }

  async getLongLivedToken(shortLivedToken: string) {
    let appId = this.configService.get<string>('FB_APP_ID') || '';
    let appSecret = this.configService.get<string>('FB_APP_SECRET') || '';

    appId = appId.trim().replace(/^["']|["']$/g, '');
    appSecret = appSecret.trim().replace(/^["']|["']$/g, '');

    const url = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;

    const response = await fetch(url);
    const data = await response.json();

    return data.access_token;
  }
  async getFacebookAndInstagramAccounts(userToken: string) {
    // 1. Obtener páginas de Facebook del usuario (incluyendo campos anidados para Instagram)
    this.logger.log(`Consultando /me/accounts para FB + IG con token: ${userToken.substring(0, 10)}...`);
    // Campos anidados: obtenemos el IG Business Account con sus detalles (id, username, name, profile_picture_url)
    const fields = 'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}';
    const pagesUrl = `https://graph.facebook.com/v22.0/me/accounts?fields=${fields}&access_token=${userToken}`;
    
    console.log('🚀 [IG DEBUG] LLAMANDO A GRAPH API PARA CUENTAS...');

    const response = await fetch(pagesUrl);
    const data: any = await response.json();

    console.log('TOKEN USADO:', userToken);
    console.log('FACEBOOK PAGES FULL:', JSON.stringify(data, null, 2));

    if (data.error) {
      this.logger.error('Error de Graph API:', data.error);
      throw new Error(data.error.message);
    }
    this.logger.log('-----------------------------');

    const accounts: any[] = [];
    if (data.data) {
      for (const page of data.data) {
        // A. Agregar la Página de Facebook como cuenta independiente
        accounts.push({
          provider: 'FACEBOOK',
          providerAccountId: page.id,
          username: page.name, // En FB usamos el nombre de la página como 'username' visual
          displayName: page.name,
          avatarUrl: page.picture?.data?.url || null,
          accessToken: page.access_token,
        });

        // B. Si tiene Instagram vinculado, agregarlo también
        if (page.instagram_business_account) {
          const ig = page.instagram_business_account;
          console.log(`📸 [IG DEBUG] DETECTADO INSTAGRAM: ${ig.username || ig.id} vinculado a página: ${page.name}`);
          
          accounts.push({
            provider: 'INSTAGRAM',
            providerAccountId: ig.id,
            username: ig.username || `ig_${ig.id}`,
            displayName: ig.name || ig.username || page.name,
            avatarUrl: ig.profile_picture_url || null,
            accessToken: page.access_token, // 🔥 OBLIGATORIO: Usar Page Access Token para publicar en IG
          });
        }
      }
    }

    this.logger.log(`Total cuentas encontradas (FB + IG): ${accounts.length}`);
    return accounts;
  }

  // ----------------------------------------------------------
  // 📌 Publicar en Instagram (2 pasos)
  // ----------------------------------------------------------
  async publishInstagramPost(instagramId: string, accessToken: string, imageUrl: string, caption: string) {
    this.logger.log(`Iniciando publicación en Instagram ID: ${instagramId}`);
    console.log("IG ACCESS TOKEN:", accessToken); // 🧪 LOG OBLIGATORIO SOLICITADO
    console.log("📸 CREATING INSTAGRAM CONTAINER...");
    console.log(`🖼️ IMAGE URL: ${imageUrl}`);

    // Paso 1: Crear el contenedor de media
    const containerUrl = `https://graph.facebook.com/v22.0/${instagramId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`;
    const containerRes = await fetch(containerUrl, { method: 'POST' });
    const containerData = await containerRes.json();

    if (containerData.error) {
      console.error("❌ ERROR CREATING IG CONTAINER:", containerData.error);
      throw new Error(`Error creando contenedor: ${containerData.error.message}`);
    }

    const creationId = containerData.id;
    console.log("📸 INSTAGRAM CREATION ID:", creationId);

    // Paso 2: Esperar procesamiento (Instagram requiere delay)
    console.log("⏳ ESPERANDO PROCESAMIENTO (3s)...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Paso 3: Publicar el contenedor
    console.log("🚀 PUBLICANDO EN INSTAGRAM...");
    const publishUrl = `https://graph.facebook.com/v22.0/${instagramId}/media_publish?creation_id=${creationId}&access_token=${accessToken}`;
    const publishRes = await fetch(publishUrl, { method: 'POST' });
    const publishData = await publishRes.json();

    if (publishData.error) {
      console.error("❌ ERROR EN PUBLISH RESPONSE:", publishData.error);
      throw new Error(`Error en media_publish: ${publishData.error.message}`);
    }

    console.log("🚀 INSTAGRAM PUBLISH RESPONSE:", publishData);
    return publishData.id;
  }

  // ----------------------------------------------------------
  // 📌 Publicar en Facebook Page
  // ----------------------------------------------------------
  async publishFacebookPost(pageId: string, accessToken: string, message: string, imageUrl?: string) {
    this.logger.log(`Iniciando publicación en Facebook Page ID: ${pageId}`);

    let url: string;
    if (imageUrl) {
      // 🖼️ PUBLICACIÓN CON IMAGEN (ENDPOINT /photos)
      console.log("FACEBOOK IMAGE POST:", { pageId, imageUrl, message }); // 🧪 LOG OBLIGATORIO
      url = `https://graph.facebook.com/v22.0/${pageId}/photos?url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(message)}&access_token=${accessToken}`;
    } else {
      // ✍️ PUBLICACIÓN SOLO TEXTO (ENDPOINT /feed)
      url = `https://graph.facebook.com/v22.0/${pageId}/feed?message=${encodeURIComponent(message)}&access_token=${accessToken}`;
    }
    
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();

    console.log("FACEBOOK RESPONSE:", data); // 🧪 LOG OBLIGATORIO

    if (data.error) {
      console.error("❌ ERROR EN FACEBOOK API:", data.error);
      throw new Error(data.error.message);
    }

    if (!data.id) {
      console.error("❌ ERROR: Facebook no devolvió un ID de post.");
      throw new Error("Facebook API no devolvió un ID de publicación válido.");
    }

    this.logger.log(`¡Publicación en Facebook completada! Post ID: ${data.id}`);
    return data.id;
  }
}
