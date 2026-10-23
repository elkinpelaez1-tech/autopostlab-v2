import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organization: {
      update: jest.fn(),
    },
    billingNotification: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should apply manual PRO access for authorized email', async () => {
    const fakeOrg = {
      id: 'org-123',
      plan: 'FREE',
      planExpiresAt: null,
      hadPro: true,
    };
    const fakeUser = {
      id: 'user-123',
      email: 'humberto856247@hotmail.com',
      organization: fakeOrg,
    };

    mockPrismaService.user.findFirst.mockResolvedValue(fakeUser);
    mockPrismaService.organization.update.mockResolvedValue({
      ...fakeOrg,
      plan: 'PRO',
      planExpiresAt: new Date('2027-10-23T23:59:59.999Z'),
    });
    mockPrismaService.billingNotification.deleteMany.mockResolvedValue({ count: 1 });
    mockPrismaService.billingNotification.findFirst.mockResolvedValue(null);
    mockPrismaService.billingNotification.create.mockResolvedValue({ id: 'notif-1' });

    await service.onModuleInit();

    expect(mockPrismaService.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-123' },
        data: expect.objectContaining({
          plan: 'PRO',
          hadPro: true,
        }),
      }),
    );
    expect(mockPrismaService.billingNotification.deleteMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-123',
        type: { in: ['EXPIRED', 'EXPIRING_SOON'] },
      },
    });
  });
});
