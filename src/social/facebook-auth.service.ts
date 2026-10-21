import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

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

  getAuthorizationUrl(workspaceId: string, requestPagePublish?: boolean) {
    let appId = this.configService.get<string>('FB_APP_ID') || '';
    let redirectUri = this.configService.get<string>('FB_REDIRECT_URI') || '';
    // Determine if test mode is enabled
    const testMode = this.configService.get<string>('FB_OAUTH_TEST_MODE') === 'standard';
    let state: string;
    if (testMode) {
      const secret = this.configService.get<string>('FB_OAUTH_STATE_SECRET');
      if (!secret) {
        throw new Error('Missing FB_OAUTH_STATE_SECRET for test mode');
      }
      const timestamp = Date.now().toString();
      const signature = crypto.createHmac('sha256', secret).update(`${workspaceId}:${timestamp}`).digest('hex');
      state = `${workspaceId}:${timestamp}:${signature}`;
    } else {
      state = workspaceId || Date.now().toString();
    }

    // Limpiar comillas innecesarias que puedan venir del .env o de Render
    const rawAppId = appId;
    const rawRedirectUri = redirectUri;
    appId = appId.trim().replace(/^["']|["']$/g, '');
    redirectUri = redirectUri.trim().replace(/^["']|["']$/g, '');
    
    // 🔑 SCOPES OFICIALES PARA INSTAGRAM GRAPH API Y FACEBOOK PAGES (GRAPH API V19+)
    // Build scopes list; Instagram scopes only in production (non‑test) mode
    const scopesList: string[] = ['public_profile', 'pages_show_list', 'pages_read_engagement'];
    if (!testMode) {
      // Instagram permissions (require app review)
      scopesList.push('instagram_basic', 'instagram_content_publish');
    }
    // Conditionally include pages_manage_posts if requested
    const envRequestPagePublish = this.configService.get<string>('FB_REQUEST_PAGE_PUBLISH') === 'true';
    if (requestPagePublish || envRequestPagePublish) {
      scopesList.push('pages_manage_posts');
    }




    // Validate required environment variables for URL construction
    const requiredEnv = {
      FB_APP_ID: appId,
      FB_REDIRECT_URI: redirectUri,
      // FB_CONFIG_ID is required only in production (Business Login)
      FB_CONFIG_ID: testMode ? '' : this.configService.get<string>('FB_CONFIG_ID') || '',
    };
    Object.entries(requiredEnv).forEach(([key, value]) => {
      this.logger.log(`ENV ${key}: ${value ? 'PRESENT' : 'MISSING'}`);
      if (!value) {
        // Omit FB_CONFIG_ID check in test mode
        if (key === 'FB_CONFIG_ID' && testMode) return;
        throw new Error(`Missing required environment variable: ${key}`);
      }
    });


    // Cuando se provee config_id, usamos el flujo Business Login (no enviamos scope)
    // Build Authorization URL based on mode (test standard vs Business Login)
    let authUrl: string;
    if (testMode) {
      // Standard OAuth flow with scopes, no config_id
      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        auth_type: 'rerequest',
        scope: scopesList.join(','),
      });
      authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    } else {
      // Business Login flow, requires config_id, no scope
      const configId = this.configService.get<string>('FB_CONFIG_ID')?.trim().replace(/^[\"']|[\"']$/g, '') || '';
      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        override_default_response_type: 'true',
        config_id: configId,
        state,
        auth_type: 'rerequest',
      });
      authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    }
    this.logger.debug('Facebook OAuth URL generated', {
      testMode,
      requestPagePublish: !!(requestPagePublish || envRequestPagePublish),
    });

    return authUrl;
  }

  async exchangeCodeForToken(code: string, overrideRedirectUri?: string) {
    let appId = this.configService.get<string>('FB_APP_ID') || '';
    let appSecret = this.configService.get<string>('FB_APP_SECRET') || '';
    let redirectUri = overrideRedirectUri || this.configService.get<string>('FB_REDIRECT_URI') || '';

    appId = appId.trim().replace(/^["']|["']$/g, '');
    appSecret = appSecret.trim().replace(/^["']|["']$/g, '');
    redirectUri = redirectUri.trim().replace(/^["']|["']$/g, '');

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      client_secret: appSecret,
      code: code,
    });
    const url = `https://graph.facebook.com/v22.0/oauth/access_token?${params.toString()}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      this.logger.error(`Error intercambiando código: ${data.error.message || 'Unknown error'}`);
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
    this.logger.debug('Facebook Graph API fetch start');

    // A. Consultar /me para verificar la identidad de Meta sin exponer datos sensibles ni tokens
    const meUrl = `https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${userToken}`;
    this.logger.debug('Fetching /me endpoint');
    try {
      const meRes = await fetch(meUrl);
      const meData = await meRes.json();
      if (meData?.error) {
        this.logger.error(
          `[FB OAuth] Error en /me: code=${meData.error.code ?? 'N/A'}, subcode=${meData.error.error_subcode ?? 'N/A'}, message="${meData.error.message || 'Unknown error'}"`,
        );
      } else if (meData?.id) {
        this.logger.log(`[FB OAuth] Usuario Meta verificado: fbUserId=${meData.id}`);
      }
    } catch (e: any) {
      this.logger.error(`[FB OAuth] Error de red consultando /me: ${e?.message || 'Unknown error'}`);
    }

    // B. Consultar /me/accounts con paginación y límite de seguridad
    this.logger.log('[FB OAuth] Consultando /me/accounts para recuperar páginas de Facebook e Instagram');
    const fields =
      'id,name,access_token,tasks,picture{url},instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}';
    const MAX_PAGE_BATCHES = 5;
    let nextUrl: string | null = `https://graph.facebook.com/v22.0/me/accounts?fields=${fields}&limit=100&access_token=${userToken}`;
    let batchCount = 0;

    const rawPages: any[] = [];
    const seenPageIds = new Set<string>();

    while (nextUrl && batchCount < MAX_PAGE_BATCHES) {
      batchCount += 1;
      let data: any;
      try {
        const response = await fetch(nextUrl);
        data = await response.json();
      } catch (e: any) {
        this.logger.error(
          `[FB OAuth] Error de red en /me/accounts (lote ${batchCount}): ${e?.message || 'Unknown error'}`,
        );
        if (batchCount === 1) {
          throw new Error(e?.message || 'Error de red consultando /me/accounts');
        }
        break;
      }

      if (data?.error) {
        this.logger.error(
          `[FB OAuth] Error de Graph API en /me/accounts (lote ${batchCount}): result=error, code=${data.error.code ?? 'N/A'}, subcode=${data.error.error_subcode ?? 'N/A'}, message="${data.error.message || 'Unknown error'}"`,
        );
        throw new Error(data.error.message || 'Error de Graph API en /me/accounts');
      }

      const pageItems = Array.isArray(data?.data) ? data.data : [];
      for (const item of pageItems) {
        if (item?.id && !seenPageIds.has(item.id)) {
          seenPageIds.add(item.id);
          rawPages.push(item);
        }
      }

      nextUrl = data?.paging?.next || null;
    }

    if (nextUrl) {
      this.logger.warn(
        `[FB OAuth] Límite de seguridad de paginación alcanzado (${MAX_PAGE_BATCHES} lotes, ${rawPages.length} páginas recolectadas)`,
      );
    }

    const accounts: any[] = [];
    const seenAccountKeys = new Set<string>();

    for (const page of rawPages) {
      const pageTasks: string[] = Array.isArray(page.tasks) ? page.tasks : [];
      const hasRequiredPageTasks =
        pageTasks.length === 0 ||
        pageTasks.includes('MANAGE') ||
        pageTasks.includes('CREATE_CONTENT') ||
        pageTasks.includes('MODERATE') ||
        pageTasks.includes('ADVERTISE');

      if (!page.access_token) {
        this.logger.warn(
          `[FB OAuth] Página omitida sin Page Access Token: pageId=${page.id}, pageName="${page.name}", tasks=${JSON.stringify(pageTasks)}, result=skipped, reason=missing_page_access_token`,
        );
        continue;
      }

      if (!hasRequiredPageTasks) {
        this.logger.warn(
          `[FB OAuth] Permisos insuficientes sobre la página: pageId=${page.id}, pageName="${page.name}", tasks=${JSON.stringify(pageTasks)}, reason=insufficient_page_tasks`,
        );
      }

      // A. Agregar la Página de Facebook evitando duplicados
      const fbKey = `FACEBOOK:${page.id}`;
      if (!seenAccountKeys.has(fbKey)) {
        seenAccountKeys.add(fbKey);
        accounts.push({
          provider: 'FACEBOOK',
          providerAccountId: page.id,
          username: page.name,
          displayName: page.name,
          avatarUrl: page.picture?.data?.url || null,
          accessToken: page.access_token,
        });
      }

      // B. Detectar Instagram: 1) instagram_business_account, 2) connected_instagram_account, 3) consulta alternativa por página con Page Access Token
      let igAccount: any = null;
      let igSource = 'none';
      let fallbackErrorReason: string | null = null;

      if (page.instagram_business_account?.id) {
        igAccount = page.instagram_business_account;
        igSource = 'instagram_business_account';
      } else if (page.connected_instagram_account?.id) {
        igAccount = page.connected_instagram_account;
        igSource = 'connected_instagram_account';
      } else {
        // Consulta alternativa por página usando su Page Access Token
        const pageFallbackFields =
          'id,name,tasks,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}';
        const pageFallbackUrl = `https://graph.facebook.com/v22.0/${page.id}?fields=${pageFallbackFields}&access_token=${page.access_token}`;
        try {
          const fallbackRes = await fetch(pageFallbackUrl);
          const fallbackData: any = await fallbackRes.json();

          if (fallbackData?.error) {
            const errCode = fallbackData.error.code ?? 'N/A';
            const errSubcode = fallbackData.error.error_subcode ?? 'N/A';
            const errMsg = fallbackData.error.message ?? 'Unknown Meta error';
            fallbackErrorReason = `graph_error_code_${errCode}_subcode_${errSubcode}`;
            this.logger.error(
              `[FB OAuth] Error en consulta alternativa por página: pageId=${page.id}, pageName="${page.name}", result=error, code=${errCode}, subcode=${errSubcode}, reason=${fallbackErrorReason}, message="${errMsg}"`,
            );
          } else if (fallbackData?.instagram_business_account?.id) {
            igAccount = fallbackData.instagram_business_account;
            igSource = 'page_fallback_instagram_business_account';
          } else if (fallbackData?.connected_instagram_account?.id) {
            igAccount = fallbackData.connected_instagram_account;
            igSource = 'page_fallback_connected_instagram_account';
          }
        } catch (err: any) {
          fallbackErrorReason = 'page_fallback_network_error';
          this.logger.error(
            `[FB OAuth] Error de red en consulta alternativa para página ${page.id}: reason=${fallbackErrorReason}, message="${err?.message || 'Unknown error'}"`,
          );
        }
      }

      if (igAccount?.id) {
        const igKey = `INSTAGRAM:${igAccount.id}`;
        if (!seenAccountKeys.has(igKey)) {
          seenAccountKeys.add(igKey);
          accounts.push({
            provider: 'INSTAGRAM',
            providerAccountId: igAccount.id,
            username: igAccount.username || `ig_${igAccount.id}`,
            displayName: igAccount.name || igAccount.username || page.name,
            avatarUrl: igAccount.profile_picture_url || null,
            accessToken: page.access_token, // Usar Page Access Token para operar sobre IG
          });
          this.logger.log(
            `[FB OAuth] Instagram detectado: pageId=${page.id}, pageName="${page.name}", tasks=${JSON.stringify(pageTasks)}, result=${igSource}, igId=${igAccount.id}, username=${igAccount.username || `ig_${igAccount.id}`}, reason=linked`,
          );
        } else {
          this.logger.log(
            `[FB OAuth] Cuenta de Instagram ya incluida en esta sesión (duplicado omitido): pageId=${page.id}, igId=${igAccount.id}, reason=duplicate_in_batch`,
          );
        }
      } else {
        const reason =
          fallbackErrorReason ||
          (!hasRequiredPageTasks
            ? 'insufficient_page_tasks'
            : 'no_instagram_linked_or_not_selected_in_meta_dialog');
        this.logger.warn(
          `[FB OAuth] Página sin Instagram vinculado: pageId=${page.id}, pageName="${page.name}", tasks=${JSON.stringify(pageTasks)}, result=none, reason=${reason}`,
        );
      }
    }

    this.logger.log(
      `[FB OAuth] Total cuentas preparadas (FB + IG): ${accounts.length} (páginas procesadas: ${rawPages.length}, lotes: ${batchCount})`,
    );
    return accounts;
  }

  // ----------------------------------------------------------
  // 📌 Publicar en Instagram (2 pasos)
  // ----------------------------------------------------------
  async publishInstagramPost(instagramId: string, accessToken: string, imageUrl: string, caption: string) {
    this.logger.log(`Iniciando publicación en Instagram ID: ${instagramId}`);
    this.logger.debug('Creando contenedor de media en Instagram', { instagramId });

    // Paso 1: Crear el contenedor de media
    const containerUrl = `https://graph.facebook.com/v22.0/${instagramId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`;
    const containerRes = await fetch(containerUrl, { method: 'POST' });
    const containerData = await containerRes.json();

    if (containerData.error) {
      this.logger.error(`Error creando contenedor de Instagram: ${containerData.error.message || 'Unknown error'}`);
      throw new Error(`Error creando contenedor: ${containerData.error.message}`);
    }

    const creationId = containerData.id;
    this.logger.debug(`Contenedor de Instagram creado con éxito. ID: ${creationId}`);

    // Paso 2: Esperar procesamiento (Instagram requiere delay)
    this.logger.debug('Esperando procesamiento de contenedor de Instagram (3s)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Paso 3: Publicar el contenedor
    this.logger.debug(`Publicando contenedor de Instagram ID: ${creationId}`);
    const publishUrl = `https://graph.facebook.com/v22.0/${instagramId}/media_publish?creation_id=${creationId}&access_token=${accessToken}`;
    const publishRes = await fetch(publishUrl, { method: 'POST' });
    const publishData = await publishRes.json();

    if (publishData.error) {
      this.logger.error(`Error en media_publish de Instagram: ${publishData.error.message || 'Unknown error'}`);
      throw new Error(`Error en media_publish: ${publishData.error.message}`);
    }

    this.logger.log(`Publicación en Instagram completada. Post ID: ${publishData.id}`);
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
      this.logger.debug('Publicación en Facebook Page con imagen', { pageId });
      url = `https://graph.facebook.com/v22.0/${pageId}/photos?url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(message)}&access_token=${accessToken}`;
    } else {
      // ✍️ PUBLICACIÓN SOLO TEXTO (ENDPOINT /feed)
      this.logger.debug('Publicación en Facebook Page de texto plano', { pageId });
      url = `https://graph.facebook.com/v22.0/${pageId}/feed?message=${encodeURIComponent(message)}&access_token=${accessToken}`;
    }
    
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();

    if (data.error) {
      this.logger.error(`Error en Facebook API: ${data.error.message || 'Unknown error'}`);
      throw new Error(data.error.message);
    }

    if (!data.id) {
      this.logger.error('Facebook API no devolvió un ID de publicación válido');
      throw new Error("Facebook API no devolvió un ID de publicación válido.");
    }

    this.logger.log(`¡Publicación en Facebook completada! Post ID: ${data.id}`);
    return data.id;
  }
}
