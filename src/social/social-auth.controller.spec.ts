// src/social/social-auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SocialAuthController } from './social-auth.controller';
import { ConfigService } from '@nestjs/config';
import { FacebookAuthService } from './facebook-auth.service';
import { LinkedinAuthService } from './linkedin-auth.service';
import { TikTokAuthService } from './tiktok-auth.service';
import { SocialAccountsService } from './social-accounts.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import * as crypto from 'crypto';

describe('SocialAuthController – Facebook callback state validation and hardening', () => {
  let controller: SocialAuthController;
  let configService: ConfigService;
  let facebookService: FacebookAuthService;
  let socialAccountsService: SocialAccountsService;
  let prismaService: PrismaService;
  let mockRes: Partial<Response>;

  const FRONTEND = 'http://localhost';
  const SECRET = 'test-secret-1234567890abcdef1234567890abcdef12';

  function createSignedState(workspaceId: string, timestamp: number, secretKey = SECRET): string {
    const signature = crypto.createHmac('sha256', secretKey).update(`${workspaceId}:${timestamp}`).digest('hex');
    return `${workspaceId}:${timestamp}:${signature}`;
  }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialAuthController],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({
            FB_OAUTH_TEST_MODE: 'standard',
            FB_OAUTH_STATE_SECRET: SECRET,
          }),
        },
        {
          provide: FacebookAuthService,
          useValue: {
            exchangeCodeForToken: jest.fn(),
            getLongLivedToken: jest.fn(),
            getFacebookAndInstagramAccounts: jest.fn(),
          },
        },
        { provide: LinkedinAuthService, useValue: {} },
        { provide: TikTokAuthService, useValue: {} },
        { provide: SocialAccountsService, useValue: { create: jest.fn() } },
        { provide: AuthService, useValue: {} },
        { provide: PrismaService, useValue: { workspace: { findUnique: jest.fn() } } },
      ],
    }).compile();

    controller = module.get<SocialAuthController>(SocialAuthController);
    configService = module.get<ConfigService>(ConfigService);
    facebookService = module.get<FacebookAuthService>(FacebookAuthService);
    socialAccountsService = module.get<SocialAccountsService>(SocialAccountsService);
    prismaService = module.get<PrismaService>(PrismaService);

    process.env.FRONTEND_URL = FRONTEND;

    mockRes = {
      redirect: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;
  });

  beforeEach(() => {
    SocialAuthController.resetStateCache();
    jest.clearAllMocks();
    (mockRes.redirect as jest.Mock).mockClear();
  });

  // 1. Estado sin firma
  it('1. rejects state without signature or incomplete parts', async () => {
    await controller.facebookCallback('FAKE_CODE', 'no-signature', {}, mockRes as Response);
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?error=invalid_state`);
    expect(facebookService.exchangeCodeForToken).not.toHaveBeenCalled();
    expect(socialAccountsService.create).not.toHaveBeenCalled();
  });

  // 2. workspaceId inválido
  it('2. rejects invalid workspaceId format', async () => {
    const now = Date.now();
    const invalidWsState = createSignedState('invalid@workspace#id', now);
    await controller.facebookCallback('FAKE_CODE', invalidWsState, {}, mockRes as Response);
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?error=invalid_workspace_id`);
    expect(facebookService.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  // 3. Firma malformada (no 64-hex chars)
  it('3. rejects malformed signature (not 64-hex chars)', async () => {
    const now = Date.now();
    await controller.facebookCallback('FAKE_CODE', `ws-id:${now}:ABC123XYZ`, {}, mockRes as Response);
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?error=invalid_state_signature_format`);
    expect(facebookService.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  // 4. Firma incorrecta
  it('4. rejects correctly-formatted but wrong signature', async () => {
    const now = Date.now();
    const wrongSig = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    await controller.facebookCallback('FAKE_CODE', `ws-id:${now}:${wrongSig}`, {}, mockRes as Response);
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?error=invalid_state_signature`);
    expect(facebookService.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  // 5. Estado expirado (> 5 minutos)
  it('5. rejects expired state (> 5 minutes old)', async () => {
    const expiredTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const expiredState = createSignedState('valid-ws', expiredTimestamp);
    await controller.facebookCallback('FAKE_CODE', expiredState, {}, mockRes as Response);
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?error=state_expired`);
    expect(facebookService.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  // 6. Timestamp futuro fuera del margen permitido (> 1 minuto)
  it('6. rejects timestamp too far in the future (> 1 minute ahead)', async () => {
    const futureTimestamp = Date.now() + 2 * 60 * 1000; // 2 minutes in future
    const futureState = createSignedState('valid-ws', futureTimestamp);
    await controller.facebookCallback('FAKE_CODE', futureState, {}, mockRes as Response);
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?error=state_expired`);
    expect(facebookService.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  // 7. Estado reutilizado (replay attack)
  it('7. rejects reused state on second callback invocation', async () => {
    const now = Date.now();
    const validState = createSignedState('valid-ws', now);

    (facebookService.exchangeCodeForToken as jest.Mock).mockResolvedValue('user-token');
    (facebookService.getLongLivedToken as jest.Mock).mockResolvedValue('long-lived-token');
    (facebookService.getFacebookAndInstagramAccounts as jest.Mock).mockResolvedValue([]);

    // First attempt -> processes state and enters logic (fails at no_accounts_found without DB write)
    await controller.facebookCallback('FAKE_CODE', validState, {}, mockRes as Response);
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?error=no_accounts_found`);

    // Second attempt with exact same state -> must be rejected as reused
    (mockRes.redirect as jest.Mock).mockClear();
    await controller.facebookCallback('FAKE_CODE', validState, {}, mockRes as Response);
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?error=invalid_state_reused`);
  });

  // 8. Flujo estándar exitoso
  it('8. processes valid signed state and succeeds on happy path', async () => {
    const workspace = 'valid_ws-123';
    const now = Date.now();
    const validState = createSignedState(workspace, now);

    (facebookService.exchangeCodeForToken as jest.Mock).mockResolvedValue('user-token');
    (facebookService.getLongLivedToken as jest.Mock).mockResolvedValue('long-lived-token');
    (facebookService.getFacebookAndInstagramAccounts as jest.Mock).mockResolvedValue([
      { provider: 'FACEBOOK', providerAccountId: '123', username: 'testpage', displayName: 'Test Page', avatarUrl: '', accessToken: 'token' },
    ]);
    (socialAccountsService.create as jest.Mock).mockImplementation(async (data) => ({ id: 'acc1', ...data }));
    (prismaService.workspace.findUnique as jest.Mock).mockResolvedValue({ owner: { organizationId: 'org1' } });

    await controller.facebookCallback('FAKE_CODE', validState, {}, mockRes as Response);

    expect(facebookService.exchangeCodeForToken).toHaveBeenCalledWith('FAKE_CODE');
    expect(facebookService.getLongLivedToken).toHaveBeenCalledWith('user-token');
    expect(facebookService.getFacebookAndInstagramAccounts).toHaveBeenCalledWith('long-lived-token');
    expect(socialAccountsService.create).toHaveBeenCalled();
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?success_connection=true`);
  });

  // 9. Business Login con modo estándar desactivado
  it('9. supports Business Login flow without signature validation when test mode is disabled', async () => {
    // Override config to simulate production / non-standard mode
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'FB_OAUTH_TEST_MODE') return undefined; // not standard
      return null;
    });

    (facebookService.exchangeCodeForToken as jest.Mock).mockResolvedValue('user-token');
    (facebookService.getLongLivedToken as jest.Mock).mockResolvedValue('long-lived-token');
    (facebookService.getFacebookAndInstagramAccounts as jest.Mock).mockResolvedValue([
      { provider: 'FACEBOOK', providerAccountId: '999', username: 'bizpage', displayName: 'Biz Page', avatarUrl: '', accessToken: 'token' },
    ]);
    (socialAccountsService.create as jest.Mock).mockResolvedValue({ id: 'acc2' });
    (prismaService.workspace.findUnique as jest.Mock).mockResolvedValue({ owner: { organizationId: 'org1' } });

    // Raw workspaceId without signature or timestamp
    await controller.facebookCallback('FAKE_CODE', 'biz-workspace-uuid', {}, mockRes as Response);

    expect(facebookService.exchangeCodeForToken).toHaveBeenCalledWith('FAKE_CODE');
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?success_connection=true`);

    // Restore configService mock
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'FB_OAUTH_TEST_MODE') return 'standard';
      if (key === 'FB_OAUTH_STATE_SECRET') return SECRET;
      return null;
    });
  });

  // 10. Error de intercambio de token con redirección genérica
  it('10. redirects with generic error code and does not leak internal error message', async () => {
    const now = Date.now();
    const validState = createSignedState('ws-test', now);

    (facebookService.exchangeCodeForToken as jest.Mock).mockRejectedValue(
      new Error('Meta Graph API internal secret error: code 190 invalid subcode 463')
    );

    await controller.facebookCallback('FAKE_CODE', validState, {}, mockRes as Response);

    // Verify generic redirection
    expect(mockRes.redirect).toHaveBeenCalledWith(`${FRONTEND}/dashboard/social-accounts?error=facebook_connection_failed`);
    // Ensure the sensitive internal error was NOT leaked in the redirect URL
    const redirectUrl = (mockRes.redirect as jest.Mock).mock.calls[0][0];
    expect(redirectUrl).not.toContain('Meta Graph API');
    expect(redirectUrl).not.toContain('secret');
  });

  // 11. Generación de URL OAuth estándar y firma del estado en 3 partes
  it('11. generates standard OAuth URL with 3-part signed state in FacebookAuthService', () => {
    const realFacebookService = new FacebookAuthService(new ConfigService({
      FB_APP_ID: 'test-app-id',
      FB_REDIRECT_URI: 'http://localhost:3000/api/social-auth/callback/facebook',
      FB_OAUTH_TEST_MODE: 'standard',
      FB_OAUTH_STATE_SECRET: SECRET,
    }));

    const urlString = realFacebookService.getAuthorizationUrl('ws-local-123');
    const parsedUrl = new URL(urlString);

    expect(parsedUrl.origin).toBe('https://www.facebook.com');
    expect(parsedUrl.pathname).toBe('/v19.0/dialog/oauth');
    expect(parsedUrl.searchParams.get('client_id')).toBe('test-app-id');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/social-auth/callback/facebook');
    expect(parsedUrl.searchParams.get('scope')).toBe('public_profile,pages_show_list,pages_read_engagement');
    expect(parsedUrl.searchParams.get('config_id')).toBeNull(); // No config_id in standard test mode

    // Validate 3-part state
    const state = parsedUrl.searchParams.get('state');
    expect(state).toBeTruthy();
    const parts = state!.split(':');
    expect(parts.length).toBe(3);

    const [ws, ts, sig] = parts;
    expect(ws).toBe('ws-local-123');
    expect(Number(ts)).toBeGreaterThan(0);
    expect(Math.abs(Date.now() - Number(ts))).toBeLessThan(5000);

    // Verify cryptographic HMAC signature matches
    const expectedSig = crypto.createHmac('sha256', SECRET).update(`${ws}:${ts}`).digest('hex');
    expect(sig).toBe(expectedSig);
  });
});

describe('Facebook & Instagram third-party linking, pagination, fallbacks, permissions, and organization deduplication', () => {
  const originalFetch = global.fetch;
  let facebookAuthService: FacebookAuthService;
  let socialAccountsService: SocialAccountsService;
  let mockPrisma: any;

  beforeEach(() => {
    facebookAuthService = new FacebookAuthService(
      new ConfigService({
        FB_APP_ID: '957507136733864',
        FB_APP_SECRET: 'test-app-secret',
        FB_REDIRECT_URI: 'https://app.autopostlab.me/api/social-auth/callback/facebook',
        FB_CONFIG_ID: '1325643506039338',
      }),
    );

    mockPrisma = {
      socialAccount: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: 'org-third-party', plan: 'PRO' }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ws-third-party',
          owner: { organizationId: 'org-third-party' },
        }),
      },
    };

    socialAccountsService = new SocialAccountsService(mockPrisma as unknown as PrismaService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('1. Página con Instagram detectado directamente (instagram_business_account)', async () => {
    const fetchMock = jest.fn()
      // /me
      .mockResolvedValueOnce({
        json: async () => ({ id: 'fb-user-1', name: 'Third Party User' }),
      })
      // /me/accounts
      .mockResolvedValueOnce({
        json: async () => ({
          data: [
            {
              id: 'page-100',
              name: 'Marca Tercero',
              access_token: 'page-token-secret-100',
              tasks: ['MANAGE', 'CREATE_CONTENT'],
              picture: { data: { url: 'https://img.test/fb.jpg' } },
              instagram_business_account: {
                id: 'ig-200',
                username: 'marcatest',
                name: 'Marca Test IG',
                profile_picture_url: 'https://img.test/ig.jpg',
              },
            },
          ],
        }),
      });
    global.fetch = fetchMock as any;

    const accounts = await facebookAuthService.getFacebookAndInstagramAccounts('user-token-xyz');

    expect(fetchMock).toHaveBeenCalledTimes(2); // No per-page fallback needed
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toEqual({
      provider: 'FACEBOOK',
      providerAccountId: 'page-100',
      username: 'Marca Tercero',
      displayName: 'Marca Tercero',
      avatarUrl: 'https://img.test/fb.jpg',
      accessToken: 'page-token-secret-100',
    });
    expect(accounts[1]).toEqual({
      provider: 'INSTAGRAM',
      providerAccountId: 'ig-200',
      username: 'marcatest',
      displayName: 'Marca Test IG',
      avatarUrl: 'https://img.test/ig.jpg',
      accessToken: 'page-token-secret-100',
    });
  });

  it('2. Instagram detectado mediante connected_instagram_account cuando instagram_business_account no viene', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        json: async () => ({ id: 'fb-user-2', name: 'Connected IG User' }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: [
            {
              id: 'page-101',
              name: 'Página Con Connected IG',
              access_token: 'page-token-101',
              tasks: ['CREATE_CONTENT'],
              connected_instagram_account: {
                id: 'ig-201',
                username: 'connected_ig_user',
                name: 'Connected IG',
                profile_picture_url: 'https://img.test/ig201.jpg',
              },
            },
          ],
        }),
      });
    global.fetch = fetchMock as any;

    const accounts = await facebookAuthService.getFacebookAndInstagramAccounts('user-token-2');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(accounts).toHaveLength(2);
    expect(accounts[1]).toMatchObject({
      provider: 'INSTAGRAM',
      providerAccountId: 'ig-201',
      username: 'connected_ig_user',
      accessToken: 'page-token-101',
    });
  });

  it('3. Instagram detectado mediante la consulta alternativa por página con su Page Access Token', async () => {
    const fetchMock = jest.fn()
      // 1) /me
      .mockResolvedValueOnce({
        json: async () => ({ id: '10244826397609835', name: 'Elkin Peláez' }),
      })
      // 2) /me/accounts (devuelve página sin instagram_business_account ni connected_instagram_account)
      .mockResolvedValueOnce({
        json: async () => ({
          data: [
            {
              id: '112785043575258',
              name: 'Profes al Aula',
              access_token: 'page-access-token-profes',
              tasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE'],
            },
          ],
        }),
      })
      // 3) Consulta alternativa GET /v22.0/112785043575258?fields=... con Page Access Token
      .mockResolvedValueOnce({
        json: async () => ({
          id: '112785043575258',
          name: 'Profes al Aula',
          connected_instagram_account: {
            id: '17841448559302494',
            username: 'profesalaula1',
            name: 'Profes al Aula',
            profile_picture_url: 'https://img.test/profes.jpg',
          },
        }),
      });
    global.fetch = fetchMock as any;

    const accounts = await facebookAuthService.getFacebookAndInstagramAccounts('user-token-elkin');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('https://graph.facebook.com/v22.0/112785043575258?');
    expect(fetchMock.mock.calls[2][0]).toContain('access_token=page-access-token-profes');
    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({
      provider: 'FACEBOOK',
      providerAccountId: '112785043575258',
      displayName: 'Profes al Aula',
    });
    expect(accounts[1]).toMatchObject({
      provider: 'INSTAGRAM',
      providerAccountId: '17841448559302494',
      username: 'profesalaula1',
      accessToken: 'page-access-token-profes',
    });
  });

  it('4. Paginación de páginas de Facebook en /me/accounts con límite de seguridad', async () => {
    const fetchMock = jest.fn()
      // /me
      .mockResolvedValueOnce({
        json: async () => ({ id: 'fb-user-paginated', name: 'Agency Manager' }),
      })
      // Lote 1 de /me/accounts
      .mockResolvedValueOnce({
        json: async () => ({
          data: [
            {
              id: 'page-1',
              name: 'Page One',
              access_token: 'tok-1',
              tasks: ['MANAGE'],
              instagram_business_account: { id: 'ig-1', username: 'ig_one' },
            },
          ],
          paging: { next: 'https://graph.facebook.com/v22.0/me/accounts?after=cursor_2' },
        }),
      })
      // Lote 2 de /me/accounts
      .mockResolvedValueOnce({
        json: async () => ({
          data: [
            {
              id: 'page-2',
              name: 'Page Two',
              access_token: 'tok-2',
              tasks: ['MANAGE'],
              connected_instagram_account: { id: 'ig-2', username: 'ig_two' },
            },
          ],
          paging: {},
        }),
      });
    global.fetch = fetchMock as any;

    const accounts = await facebookAuthService.getFacebookAndInstagramAccounts('user-token-paginated');

    expect(accounts).toHaveLength(4);
    expect(accounts.map((a) => `${a.provider}:${a.providerAccountId}`)).toEqual([
      'FACEBOOK:page-1',
      'INSTAGRAM:ig-1',
      'FACEBOOK:page-2',
      'INSTAGRAM:ig-2',
    ]);
  });

  it('5. Usuario sin permisos suficientes: registra error concreto (code/subcode) y evita falso éxito', async () => {
    mockPrisma.socialAccount.findMany.mockResolvedValue([
      {
        id: 'fb-rec-1',
        provider: 'FACEBOOK',
        providerAccountId: '112785043575258',
        displayName: 'Profes al Aula',
        accessToken: 'restricted-page-token-secret',
        workspaceId: 'ws-third-party',
        organizationId: 'org-third-party',
        status: 'ACTIVE',
      },
    ]);

    const fetchMock = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        error: {
          message: 'User access is restricted',
          type: 'OAuthException',
          code: 25,
          error_subcode: 2207050,
        },
      }),
    });
    global.fetch = fetchMock as any;

    const errorSpy = jest.spyOn((socialAccountsService as any).logger, 'error');
    const result = await socialAccountsService.detectAndLinkInstagramAccounts(
      'ws-third-party',
      'org-third-party',
    );

    expect(result.created).toBe(0);
    expect(result.reason).toBe('INSUFFICIENT_PERMISSIONS');
    expect(result.message).toContain('faltan permisos');
    expect(result.accounts).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('code=25, subcode=2207050, reason=insufficient_permissions_or_restricted_access'),
    );
    // Verifica que no expone el token en los logs
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('restricted-page-token-secret');
  });

  it('6. Usuario que desconectó Facebook e intenta conectar Instagram recibe mensaje claro', async () => {
    mockPrisma.socialAccount.findMany.mockResolvedValue([]);

    const result = await socialAccountsService.detectAndLinkInstagramAccounts(
      'ws-disconnected',
      'org-third-party',
    );

    expect(result.created).toBe(0);
    expect(result.reason).toBe('NO_ACTIVE_FACEBOOK_PAGES');
    expect(result.message).toBe(
      'Primero debes conectar una página de Facebook activa antes de vincular Instagram.',
    );
    expect(result.accounts).toEqual([]);
  });

  it('7. Asociación correcta por organización y prevención de duplicados en BD y en escaneo', async () => {
    // Caso A: Dos páginas en el mismo workspace apuntando al mismo Instagram no duplican llamadas a create()
    mockPrisma.socialAccount.findMany.mockResolvedValue([
      {
        id: 'fb-1',
        provider: 'FACEBOOK',
        providerAccountId: 'page-a',
        displayName: 'Page A',
        accessToken: 'tok-a',
        workspaceId: 'ws-third-party',
        organizationId: 'org-third-party',
        status: 'ACTIVE',
      },
      {
        id: 'fb-2',
        provider: 'FACEBOOK',
        providerAccountId: 'page-b',
        displayName: 'Page B',
        accessToken: 'tok-b',
        workspaceId: 'ws-third-party',
        organizationId: 'org-third-party',
        status: 'ACTIVE',
      },
    ]);

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'page-a',
          name: 'Page A',
          tasks: ['MANAGE'],
          instagram_business_account: { id: 'ig-shared-999', username: 'shared_ig' },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'page-b',
          name: 'Page B',
          tasks: ['MANAGE'],
          connected_instagram_account: { id: 'ig-shared-999', username: 'shared_ig' },
        }),
      });
    global.fetch = fetchMock as any;

    // Primera vez: existe en BD -> debe actualizar (update) y no duplicar (create)
    mockPrisma.socialAccount.findFirst.mockResolvedValue({
      id: 'existing-ig-record',
      workspaceId: 'ws-third-party',
      organizationId: 'org-third-party',
      provider: 'INSTAGRAM',
      providerAccountId: 'ig-shared-999',
    });
    mockPrisma.socialAccount.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      ...data,
      workspaceId: 'ws-third-party',
      provider: 'INSTAGRAM',
      providerAccountId: 'ig-shared-999',
    }));

    const result = await socialAccountsService.detectAndLinkInstagramAccounts(
      'ws-third-party',
      'org-third-party',
    );

    expect(result.created).toBe(1);
    expect(result.reason).toBe('LINKED');
    expect(mockPrisma.socialAccount.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.socialAccount.create).not.toHaveBeenCalled();
    expect(mockPrisma.socialAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-ig-record' },
        data: expect.objectContaining({
          organizationId: 'org-third-party',
          username: 'shared_ig',
          status: 'ACTIVE',
        }),
      }),
    );
  });
});
