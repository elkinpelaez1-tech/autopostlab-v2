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

  /**
   * Genera la URL de autorización para TikTok V2
   */
  getAuthorizationUrl(workspaceId: string): string {
    const baseUrl = 'https://www.tiktok.com/v2/auth/authorize/';
    const params = new URLSearchParams({
      client_key: this.clientKey,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      state: workspaceId,
    });

    // We append the scope manually to ensure the comma is not encoded as %2C
    return `${baseUrl}?${params.toString()}&scope=user.info.basic,video.upload`;
  }

  /**
   * Intercambia el código por tokens de acceso
   */
  async exchangeCodeForToken(code: string) {
    const url = 'https://open.tiktokapis.com/v2/oauth/token/';
    
    const params = new URLSearchParams();
    params.append('client_key', this.clientKey);
    params.append('client_secret', this.clientSecret);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', this.redirectUri);

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
    
    const params = new URLSearchParams();
    params.append('client_key', this.clientKey);
    params.append('client_secret', this.clientSecret);
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
    
    console.log("TIKTOK INIT WITH CAPTION:", text);

    const body = {
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize, // Para simplificar, subimos todo en un chunk si es < 50MB
        total_chunk_count: 1,
      },
      post_info: {
        caption: text
      }
    };

    try {
      if (!accessToken || accessToken === 'undefined') {
        throw new Error("TikTok API Request blocked: Access Token is missing or undefined.");
      }

      this.logger.log(`Inicializando upload en TikTok (Inbox). Tamaño: ${videoSize} bytes`);
      console.log("TOKEN USADO:", accessToken);

      const response = await axios.post(url, body, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.error && response.data.error.code !== 'ok') {
        this.logger.error('TikTok Init Detailed Error:', JSON.stringify(response.data, null, 2));
        throw new Error(`TikTok Init Error: ${JSON.stringify(response.data.error)}`);
      }

      console.log("TIKTOK INIT RESPONSE:", JSON.stringify(response.data, null, 2));
      this.logger.log(`✅ Upload inicializado. Publish ID: ${response.data.data.publish_id}`);
      return response.data.data; // Contiene publish_id y upload_url
    } catch (error) {
      console.log("TIKTOK INIT ERROR FULL:", JSON.stringify(error.response?.data, null, 2));
      console.log("TIKTOK INIT ERROR RAW:", error);
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
      console.log("TIKTOK FINAL ERROR (Upload):", JSON.stringify(error.response?.data, null, 2));
      console.log("TIKTOK UPLOAD ERROR RAW:", error);
      const apiDetail = error.response?.data?.error?.message || error.response?.data?.message;
      throw new Error(apiDetail ? `TikTok API Upload: ${apiDetail}` : error.message);
    }
  }

  /**
   * Consulta el estado de una publicación
   * Doc: https://developers.tiktok.com/doc/content-posting-api-v2-post-publish-status-fetch/
   */
  async getPublishStatus(accessToken: string, publishId: string) {
    const url = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
    
    try {
      if (!accessToken || accessToken === 'undefined') {
        throw new Error("TikTok API Request blocked: Access Token is missing or undefined.");
      }

      console.log("TOKEN USADO:", accessToken);

      const response = await axios.post(url, { publish_id: publishId }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.error && response.data.error.code !== 'ok') {
        this.logger.error('TikTok Status Detailed Error:', JSON.stringify(response.data, null, 2));
        throw new Error(`TikTok Status Error: ${JSON.stringify(response.data.error)}`);
      }

      console.log("TIKTOK STATUS RESPONSE:", JSON.stringify(response.data, null, 2));
      // No lanzamos error aquí si el estado es intermedio (ej. PROCESSING)
      return response.data.data;
    } catch (error) {
      console.log("TIKTOK FINAL ERROR (Status):", JSON.stringify(error.response?.data, null, 2));
      console.log("TIKTOK STATUS ERROR RAW:", error);
      throw error;
    }
  }
}
