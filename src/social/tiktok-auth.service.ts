import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TikTokAuthService {
  private readonly logger = new Logger(TikTokAuthService.name);
  private readonly clientKey: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private configService: ConfigService) {
    this.clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY') || '';
    this.clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('TIKTOK_REDIRECT_URI') || '';
  }

  getAuthorizationUrl(workspaceId: string): string {
    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY');
    const redirectUri = this.configService.get<string>('TIKTOK_REDIRECT_URI');

    console.log(`[TIKTOK_DEBUG] Generando URL con ClientKey: ${clientKey?.substring(0, 5)}... y Redirect: ${redirectUri}`);

    const baseUrl = 'https://www.tiktok.com/v2/auth/authorize/';
    const params = new URLSearchParams({
      client_key: clientKey || '',
      response_type: 'code',
      redirect_uri: redirectUri || '',
      state: workspaceId,
    });

    // We append the scope manually to ensure the comma is not encoded as %2C
    return `${baseUrl}?${params.toString()}&scope=user.info.basic,video.upload,video.publish`;
  }

  /**
   * Intercambia el código por tokens de acceso
   */
  async exchangeCodeForToken(code: string) {
    const url = 'https://open.tiktokapis.com/v2/oauth/token/';
    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY');
    const clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('TIKTOK_REDIRECT_URI');
    
    const params = new URLSearchParams();
    params.append('client_key', clientKey || '');
    params.append('client_secret', clientSecret || '');
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUri || '');

    try {
      const response = await axios.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
      });

      const data = response.data;

      if (data.error) {
        throw new Error(`TikTok Auth Error: ${data.error_description || data.error}`);
      }

      // TikTok V2 API sometimes wraps the response in a 'data' object
      const tokenPayload = data.data ? data.data : data;

      // Estructura sugerida por el usuario: openId, accessToken, refreshToken, expiresAt
      console.log('TIKTOK ACCESS TOKEN:', tokenPayload.access_token);
      console.log('USING DIRECT POST FLOW');

      // 1️⃣  Obtener opciones de privacidad
      const creatorInfo = await this.creatorInfoQuery(tokenPayload.access_token);
      const privacyOptions = creatorInfo?.privacy_level_options || [];
      const chosenPrivacy = privacyOptions.includes('SELF_ONLY')
        ? 'SELF_ONLY'
        : privacyOptions[0] || 'SELF_ONLY';
      console.log(`[TIKTOK] Privacy level elegida: ${chosenPrivacy}`);

      // 2️⃣ Initialise upload with chosen privacy
      console.log(`[TIKTOK] Intentando inicializar upload directo...`);
      // Note: This assumes this.initializeDirectUpload exists, usually added in extended logic
      const initData = await (this as any).initializeDirectUpload(
        tokenPayload.access_token,
        0, // placeholder, would be videoBuffer.length
        chosenPrivacy,
      );
      console.log(`[TIKTOK] 1/3 Init OK: publish_id=${initData.publish_id}, upload_url=${initData.upload_url}`);

      // 3️⃣ Subir archivo binario
      console.log(`[TIKTOK] 2/3 Subiendo bytes...`);
      // 4️⃣ Poll status until publish complete or failure
      const publishId = initData.publish_id;
      let attempts = 0;
      const maxAttempts = 5;
      let finalStatus = '';
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await (this as any).checkVideoStatus(tokenPayload.access_token, publishId);
        finalStatus = statusRes?.status;
        console.log(`[TIKTOK] Poll ${attempts}: status = ${finalStatus}`);
        if (finalStatus === 'PUBLISH_COMPLETE') {
          console.log('[TIKTOK] ✅ Publicación completada exitosamente.');
          break;
        }
        if (finalStatus === 'FAILED') {
          const reason = statusRes?.fail_reason || 'unknown';
          throw new Error(`TikTok video upload failed: ${reason}`);
        }
      }
      if (finalStatus !== 'PUBLISH_COMPLETE') {
        throw new Error(`TikTok video did not reach PUBLISH_COMPLETE; último estado: ${finalStatus}`);
      }

      return {
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token,
        openId: tokenPayload.open_id,
        expiresIn: tokenPayload.expires_in,
        expiresAt: new Date(Date.now() + (tokenPayload.expires_in || 0) * 1000),
      };
    } catch (error) {
      this.logger.error('Error intercambiando código de TikTok:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene la información básica del perfil del usuario
   */
  async getUserProfile(accessToken: string) {
    const url = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username';

    try {
      if (!accessToken || accessToken === 'undefined') {
        throw new Error("TikTok API Request blocked: Access Token is missing or undefined.");
      }

      console.log("TOKEN USADO:", accessToken);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = response.data;

      if (data.error) {
        throw new Error(`TikTok User Info Error: ${data.error.message}`);
      }

      const user = data.data.user;
      return {
        openId: user.open_id,
        username: user.username || user.display_name,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      };
    } catch (error) {
      console.log("TIKTOK ERROR FULL:", JSON.stringify(error.response?.data));
      throw error;
    }
  }

  /**
   * Refresca un access_token usando el refresh_token
   */
  async refreshToken(refreshToken: string) {
    const url = 'https://open.tiktokapis.com/v2/oauth/token/';
    const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY');
    const clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET');

    const params = new URLSearchParams();
    params.append('client_key', clientKey || '');
    params.append('client_secret', clientSecret || '');
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    try {
      const response = await axios.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
      });

      const data = response.data;

      if (data.error) {
        throw new Error(`TikTok Refresh Error: ${data.error_description || data.error}`);
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      this.logger.error('Error refrescando token de TikTok:', error.response?.data || error.message);
      throw error;
    }
  }
  /**
   * Inicializa la subida de un video para Inbox (Drafts)
   * Doc: https://developers.tiktok.com/doc/content-posting-api-v2-post-publish-inbox-video-init/
   */
  async initializeInboxUpload(accessToken: string, videoSize: number, text: string) {
    const url = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
    
    const body = {
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1
      }
    };

    console.log('------------------ [TIKTOK PUBLISH DEBUG] ------------------');
    console.log(`URL de inicialización: ${url}`);
    console.log('PAYLOAD enviado a TikTok:', JSON.stringify(body, null, 2));
    console.log('Caption/Texto enviado:', text);
    console.log('Access Token usado (truncado):', accessToken ? `${accessToken.substring(0, 15)}...` : 'N/A');

    try {
      if (!accessToken || accessToken === 'undefined') {
        throw new Error("TikTok API Request blocked: Access Token is missing or undefined.");
      }

      this.logger.log(`Inicializando upload en TikTok (Inbox). Tamaño: ${videoSize} bytes`);

      const response = await axios.post(url, body, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      });

      console.log('--- RESPUESTA EXITOSA DE TIKTOK ---');
      console.log('Status HTTP:', response.status);
      console.log('Headers de respuesta:', JSON.stringify(response.headers, null, 2));
      console.log('Body de respuesta:', JSON.stringify(response.data, null, 2));

      if (response.data.error && response.data.error.code !== 'ok') {
        this.logger.error('TikTok Init Detailed Error:', JSON.stringify(response.data, null, 2));
        throw new Error(`TikTok Init Error: ${JSON.stringify(response.data.error)}`);
      }

      this.logger.log(`✅ Upload inicializado. Publish ID: ${response.data.data?.publish_id}`);
      return response.data.data; // Contiene publish_id y upload_url
    } catch (error: any) {
      console.error('--- ERROR EN INICIALIZACIÓN TIKTOK ---');
      console.error('Mensaje de error:', error?.message);
      console.error('Stack Trace:', error?.stack);
      console.error('Status HTTP de Error:', error.response?.status);
      console.error('Respuesta completa de Error (Body):', JSON.stringify(error.response?.data, null, 2));
      console.error('Headers de Error:', JSON.stringify(error.response?.headers, null, 2));
      console.error('------------------------------------------------------------');
      throw error;
    }
  }


  /**
   * Sube el archivo binario a la URL proporcionada por TikTok
   */
  async uploadVideoFile(uploadUrl: string, videoBuffer: Buffer) {
    try {
      const totalBytes = videoBuffer.length;
      this.logger.log(`Iniciando transferencia de bytes a TikTok (${totalBytes} bytes)...`);

      const response = await axios.put(uploadUrl, videoBuffer, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': totalBytes,
          'Content-Range': `bytes 0-${totalBytes - 1}/${totalBytes}`,
        },
      });

      console.log("TIKTOK UPLOAD STATUS:", response.status);
      console.log("TIKTOK UPLOAD RESPONSE:", JSON.stringify(response.data, null, 2));
      
      this.logger.log(`✅ Transferencia de video completada. Status: ${response.status}`);
      return response.status === 200 || response.status === 201;
    } catch (error) {
      console.log('TIKTOK ERROR FULL:', JSON.stringify(error.response?.data, null, 2));
      console.log('TIKTOK ERROR STATUS:', error.response?.status);
      console.log('TIKTOK ERROR HEADERS:', JSON.stringify(error.response?.headers, null, 2));
      const apiDetail = error.response?.data?.error?.message || error.response?.data?.message;
      throw new Error(apiDetail ? `TikTok API Upload: ${apiDetail}` : error.message);
    }
  }



  /**
   * Query creator info to obtain allowed privacy levels.
   * Docs: https://developers.tiktok.com/doc/content-posting-api-v2-creator-info-query/
   */
  async creatorInfoQuery(accessToken: string) {
    const url = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
    try {
      const response = await axios.post(url, {}, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      this.logger.error('TikTok creator_info/query error', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Initialise a Direct Post upload (video.publish).
   * Docs: https://developers.tiktok.com/doc/content-posting-api-v2-post-publish-video-init/
   */
  async initializeDirectUpload(accessToken: string, videoSize: number, privacyLevel: string) {
    const url = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
    const postInfo = { privacy_level: privacyLevel };
    const body = {
      post_info: postInfo,
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    };
    try {
      const response = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      });
      if (response.data.error) {
        throw new Error(`TikTok Init Direct Upload error: ${JSON.stringify(response.data.error)}`);
      }
      return response.data.data;
    } catch (error: any) {
      this.logger.error('TikTok initDirectUpload error', error.response?.data || error.message);
      throw error;
    }
  }


  /**
   * Poll video status after upload.
   * Docs: https://developers.tiktok.com/doc/content-posting-api-v2-status-fetch/
   */
  /**
   * Poll video status after upload.
   * Docs: https://developers.tiktok.com/doc/content-posting-api-v2-status-fetch/
   */
  async checkVideoStatus(accessToken: string, publishId: string) {
    const url = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
    try {
      const response = await axios.post(url, { publish_id: publishId }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      this.logger.error('TikTok checkVideoStatus error', error.response?.data || error.message);
      throw error;
    }
  }

}

