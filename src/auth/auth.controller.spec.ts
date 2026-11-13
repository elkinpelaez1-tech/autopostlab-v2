import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({ accessToken: 'mock-at', refreshToken: 'mock-rt' }),
      loginWithGoogle: jest.fn(),
      forgotPassword: jest.fn().mockResolvedValue({
        success: true,
        message: 'Si el correo está registrado, recibirás un enlace de recuperación.',
      }),
      resetPassword: jest.fn().mockResolvedValue({
        success: true,
        message: 'Contraseña actualizada correctamente.',
      }),
      refresh: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should handle forgotPassword endpoint', async () => {
    const res = await controller.forgotPassword({ email: 'test@example.com' });
    expect(res.success).toBe(true);
    expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com');
  });

  it('should handle resetPassword endpoint', async () => {
    const res = await controller.resetPassword({
      token: 'mock-token',
      newPassword: 'new-secure-pass',
    });
    expect(res.success).toBe(true);
    expect(authService.resetPassword).toHaveBeenCalledWith('mock-token', 'new-secure-pass');
  });
});
