import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

describe('AuthService - Password Recovery and Reset', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let prismaService: any;
  let jwtService: any;
  let mailService: jest.Mocked<Partial<MailService>>;

  const mockUser = {
    id: 'user-123',
    email: 'v_multidestinos@yahoo.com',
    name: 'Viajes Multidestinos',
    password: '$2b$10$existingPasswordHashForUserTesting1234567890',
    role: 'ADMIN',
    organizationId: 'org-123',
    refreshToken: 'old-refresh-token',
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
    };

    prismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      workspace: {
        findFirst: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    mailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('forgotPassword', () => {
    it('should return uniform anti-enumeration message when user does NOT exist', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      const res = await authService.forgotPassword('nonexistent@example.com');

      expect(res.success).toBe(true);
      expect(res.message).toContain('Si el correo está registrado');
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should generate a token, send email, and return success when user exists', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('signed-mock-token-xyz');

      const res = await authService.forgotPassword(mockUser.email);

      expect(res.success).toBe(true);
      expect(res.message).toContain('Si el correo está registrado');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          purpose: 'pwd_reset',
        }),
        expect.objectContaining({ expiresIn: '1h' }),
      );
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.stringContaining('token=signed-mock-token-xyz'),
        mockUser.name,
      );
    });

    it('should enforce rate limiting protection on rapid consecutive requests (< 60s)', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('signed-mock-token-xyz');

      // First call
      await authService.forgotPassword('ratelimit@example.com');
      expect(jwtService.signAsync).toHaveBeenCalledTimes(1);

      // Immediate second call
      const throttledRes = await authService.forgotPassword('ratelimit@example.com');
      expect(throttledRes.success).toBe(true);
      // Still only 1 email generated because second attempt was throttled
      expect(jwtService.signAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword', () => {
    const validSecret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret';
    const validFingerprint = crypto
      .createHmac('sha256', validSecret)
      .update(mockUser.password)
      .digest('hex')
      .substring(0, 16);

    const validPayload = {
      sub: mockUser.id,
      email: mockUser.email,
      purpose: 'pwd_reset',
      v: validFingerprint,
    };

    it('should reject short passwords (< 6 chars)', async () => {
      await expect(authService.resetPassword('some-token', '12345')).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid or expired tokens', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(authService.resetPassword('expired-token', 'newValidPass123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully update password, hash it with bcrypt, and revoke sessions', async () => {
      jwtService.verifyAsync.mockResolvedValue(validPayload);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue({ ...mockUser, refreshToken: null });

      const res = await authService.resetPassword('valid-test-token', 'NewSecurePassword2026!');

      expect(res.success).toBe(true);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          password: expect.any(String),
          refreshToken: null, // Revokes previous sessions
        },
      });

      // Verify the new password in DB was hashed with bcrypt
      const updateCall = prismaService.user.update.mock.calls[0][0];
      const isBcryptHash = updateCall.data.password.startsWith('$2b$');
      expect(isBcryptHash).toBe(true);
      expect(await bcrypt.compare('NewSecurePassword2026!', updateCall.data.password)).toBe(true);

      // Verify RefreshTokens revoked
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, revoked: false },
        data: { revoked: true },
      });
    });

    it('should reject single-use token replay (fingerprint mismatch or memory blacklist)', async () => {
      jwtService.verifyAsync.mockResolvedValue(validPayload);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.user.update.mockResolvedValue({ ...mockUser, refreshToken: null });

      // First reset succeeds
      await authService.resetPassword('replay-token', 'FirstChangePass123!');

      // Second reset with the same token must be rejected
      await expect(authService.resetPassword('replay-token', 'SecondChangePass123!')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
