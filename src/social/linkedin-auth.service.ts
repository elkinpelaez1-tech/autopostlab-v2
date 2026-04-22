import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LinkedinAuthService {
  private readonly logger = new Logger(LinkedinAuthService.name);

  constructor(private configService: ConfigService) { }

  /**
   * Genera la URL de autorización para LinkedIn
   */
  getAuthorizationUrl(workspaceId: string) {
    const state = workspaceId; // Ya no usamos timestamps para evitar errores de FK
    const redirectUri = encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI || '');
    const scope = encodeURIComponent('openid profile email w_member_social');

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID || ''}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    this.logger.log(`LinkedIn Auth URL generada para workspace: ${state}`);
    return authUrl;
  }

  /**
   * Intercambia el código por un access_token
   */
  async exchangeCodeForToken(code: string) {
    const clientId = this.configService.get('LINKEDIN_CLIENT_ID');
    const clientSecret = this.configService.get('LINKEDIN_CLIENT_SECRET');
    const redirectUri = this.configService.get('LINKEDIN_REDIRECT_URI');

    this.logger.log('Intercambiando código de LinkedIn por token...');

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', redirectUri);
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);

      const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const accessToken = response.data.access_token;
      console.log(`✅ LINKEDIN ACCESS TOKEN: ${accessToken}`);

      return accessToken;
    } catch (error) {
      this.logger.error('Error intercambiando código de LinkedIn:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene la información del usuario autenticado (OIDC)
   */
  async getUserProfile(accessToken: string) {
    this.logger.log('Obteniendo perfil de LinkedIn...');
    
    try {
      const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const userData = response.data;
      console.log('👤 LINKEDIN USER:', userData);

      return {
        id: userData.sub,
        name: userData.name,
        email: userData.email,
        picture: userData.picture,
      };
    } catch (error) {
      this.logger.error('Error obteniendo perfil de LinkedIn:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Publica un post en LinkedIn (Soporta texto e imágenes)
   */
  async createPost(accessToken: string, linkedinUserId: string, text: string, imageUrl?: string) {
    this.logger.log('Enviando post a LinkedIn...');
    const url = 'https://api.linkedin.com/v2/ugcPosts';
    const author = `urn:li:person:${linkedinUserId}`;
    let mediaAssetId: string | null = null;

    // --- PASO 1 y 2: Procesar imagen si existe ---
    if (imageUrl) {
      try {
        console.log("📸 INICIANDO PROCESO DE IMAGEN PARA LINKEDIN:", imageUrl);
        
        // 1. Register Upload
        const registerRes = await axios.post(
          'https://api.linkedin.com/v2/assets?action=registerUpload',
          {
            registerUploadRequest: {
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
              owner: author,
              serviceRelationships: [
                {
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent',
                },
              ],
            },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log("📸 REGISTER UPLOAD RESPONSE:", registerRes.data);
        
        const uploadUrl = registerRes.data.value.uploadMechanism[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ].uploadUrl;
        
        mediaAssetId = registerRes.data.value.asset;
        console.log("UPLOAD URL:", uploadUrl);

        // 2. Descargar imagen de Cloudinary y subir a LinkedIn (Binary PUT)
        const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        await axios.put(uploadUrl, imageRes.data, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'image/jpeg',
          },
        });
        console.log("📤 IMAGE UPLOADED TO LINKEDIN SERVER");
      } catch (imageError) {
        this.logger.error('❌ Error subiendo imagen a LinkedIn:', imageError.response?.data || imageError.message);
      }
    }

    // --- PASO 3: Construir Body Final ---
    const body: any = {
      author: author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: text,
          },
          shareMediaCategory: mediaAssetId ? 'IMAGE' : 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    if (mediaAssetId) {
      body.specificContent['com.linkedin.ugc.ShareContent'].media = [
        {
          status: 'READY',
          media: mediaAssetId,
          title: { text: "Imagen adjunta" }
        }
      ];
    }

    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      };

      console.log("LINKEDIN REQUEST PAYLOAD:", JSON.stringify(body, null, 2));
      console.log("LINKEDIN REQUEST HEADERS:", { ...headers, Authorization: 'Bearer [HIDDEN]' });

      const response = await axios.post(url, body, {
        headers,
        validateStatus: (status) => true,
      });

      console.log(`📡 [LINKEDIN API] Status: ${response.status}`);
      
      if (response.status !== 201) {
        const errorDetail = JSON.stringify(response.data, null, 2);
        console.log("LINKEDIN ERROR FULL (API Response):", errorDetail);
        this.logger.error(`❌ Fallo en LinkedIn API (${response.status}): ${errorDetail}`);
        throw new Error(`LINKEDIN_ERROR_${response.status}: ${errorDetail}`);
      }

      const postId = response.data.id || response.headers['x-restli-id'];
      
      if (mediaAssetId) {
        console.log("🚀 LINKEDIN POST WITH IMAGE:", response.data);
      } else {
        console.log('✅ POST LINKEDIN EXITOSO:', postId);
      }

      return response.data;
    } catch (error) {
      console.log("LINKEDIN ERROR FULL (Axios Error):", JSON.stringify(error.response?.data, null, 2));
      this.logger.error('❌ Error fatal publicando en LinkedIn:', error.message);
      throw error;
    }
  }
}
