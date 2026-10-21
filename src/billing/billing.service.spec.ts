import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

describe('BillingService – Persistent DB idempotency and Wompi PRO flow', () => {
  let service: BillingService;
  let orgStore: Map<string, any>;
  let notifStore: Array<{
    id: string;
    organizationId: string;
    type: string;
    message: string;
    emailSent: boolean;
    createdAt: Date;
  }>;
  let prisma: any;
  let mailService: { sendPaymentSuccessEmail: jest.Mock };

  const origEnv = process.env;
  const TEST_EVENTS_SECRET = 'test_wompi_events_secret_key';

  function buildSignedWompiEvent(txOverrides: Record<string, any> = {}, timestamp = 1700000000) {
    const transaction = {
      id: 'tx-default-1',
      status: 'APPROVED',
      reference: 'UPG-PRO-org-123-1700000000000',
      amount_in_cents: 4500000,
      currency: 'COP',
      ...txOverrides,
    };
    const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
    const rawToSign = `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${process.env.WOMPI_EVENTS_SECRET || ''}`;
    const checksum = crypto.createHash('sha256').update(rawToSign).digest('hex');

    return {
      body: {
        event: 'transaction.updated',
        timestamp,
        data: { transaction },
        signature: {
          properties,
          checksum,
        },
      },
      checksum,
    };
  }

  beforeEach(async () => {
    process.env = { ...origEnv };
    process.env.WOMPI_EVENTS_SECRET = TEST_EVENTS_SECRET;
    process.env.WOMPI_PUBLIC_KEY = 'pub_test_key';
    process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_secret';

    orgStore = new Map();
    notifStore = [];

    // Stateful mock that enforces PostgreSQL @@unique([organizationId, type]) and atomic transactions
    let txChain = Promise.resolve();

    const buildTxClient = () => ({
      organization: {
        findUnique: jest.fn(async ({ where }: any) => {
          const found = orgStore.get(where.id);
          return found ? { ...found } : null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const current = orgStore.get(where.id);
          if (!current) throw new Error('Organization not found');
          const updated = { ...current, ...data };
          orgStore.set(where.id, updated);
          return { ...updated };
        }),
        count: jest.fn(async () => orgStore.size),
        findMany: jest.fn(async () => Array.from(orgStore.values())),
      },
      billingNotification: {
        create: jest.fn(async ({ data }: any) => {
          const duplicate = notifStore.find(
            (n) => n.organizationId === data.organizationId && n.type === data.type,
          );
          if (duplicate) {
            const err: any = new Error('Unique constraint failed on the fields: (`organizationId`,`type`)');
            err.code = 'P2002';
            throw err;
          }
          const created = {
            id: `notif-${notifStore.length + 1}`,
            organizationId: data.organizationId,
            type: data.type,
            message: data.message,
            emailSent: Boolean(data.emailSent),
            createdAt: new Date(),
          };
          notifStore.push(created);
          return created;
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          const allowedTypes: string[] | undefined = where?.type?.in;
          const before = notifStore.length;
          notifStore = notifStore.filter((n) => {
            if (n.organizationId !== where.organizationId) return true;
            if (allowedTypes) {
              return !allowedTypes.includes(n.type);
            }
            return false;
          });
          return { count: before - notifStore.length };
        }),
        findMany: jest.fn(async ({ where }: any) => {
          const allowedTypes: string[] | undefined = where?.type?.in;
          return notifStore.filter((n) => {
            if (n.organizationId !== where.organizationId) return false;
            if (allowedTypes) {
              return allowedTypes.includes(n.type);
            }
            return true;
          });
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ email: 'admin@empresa.com', role: 'ADMIN' }]),
      },
    });

    const baseClient = buildTxClient();
    prisma = {
      ...baseClient,
      $transaction: jest.fn((cb: any) => {
        const run = txChain.then(() => cb(buildTxClient()));
        txChain = run.catch(() => undefined);
        return run;
      }),
    };

    mailService = {
      sendPaymentSuccessEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  afterAll(() => {
    process.env = origEnv;
  });

  it('1. rejects webhook immediately if WOMPI_EVENTS_SECRET is missing', async () => {
    orgStore.set('org-123', { id: 'org-123', name: 'Org 123', plan: 'FREE', planExpiresAt: null });
    const { body, checksum } = buildSignedWompiEvent({ id: 'tx-no-secret' });

    delete process.env.WOMPI_EVENTS_SECRET;

    await expect(service.handleWebhook(body, checksum)).rejects.toThrow(BadRequestException);
    expect(orgStore.get('org-123').plan).toBe('FREE');
  });

  it('2. generates individual Wompi checkout URL per organization with 45,000 COP (4500000 cents) and integrity signature', async () => {
    orgStore.set('org-123', { id: 'org-123', name: 'Org 123', plan: 'FREE', planExpiresAt: null });

    const res = await service.createCheckout('org-123', 'PRO');

    expect(res.reference).toMatch(/^UPG-PRO-org-123-\d+$/);
    expect(res.checkoutUrl).toContain('https://checkout.wompi.co/p/?');
    expect(res.checkoutUrl).toContain('amount-in-cents=4500000');
    expect(res.checkoutUrl).toContain('currency=COP');
    expect(res.checkoutUrl).toContain('signature:integrity=');
  });

  it('3. persists WOMPI_TX_<transactionId> receipt atomically in the same DB transaction, clears EXPIRED/EXPIRING_SOON alerts, and hides WOMPI_TX_* from getNotifications', async () => {
    orgStore.set('org-123', { id: 'org-123', name: 'Org 123', plan: 'FREE', planExpiresAt: null });
    notifStore.push(
      {
        id: 'n-exp',
        organizationId: 'org-123',
        type: 'EXPIRED',
        message: 'Tu plan PRO ha expirado.',
        emailSent: true,
        createdAt: new Date(),
      },
      {
        id: 'n-soon',
        organizationId: 'org-123',
        type: 'EXPIRING_SOON',
        message: 'Tu suscripción PRO está próxima a expirar.',
        emailSent: true,
        createdAt: new Date(),
      },
    );

    const { body, checksum } = buildSignedWompiEvent({
      id: 'tx-100',
      reference: 'UPG-PRO-org-123-1700000000000',
    });

    const res = await service.handleWebhook(body, checksum);

    expect(res.status).toBe('UPGRADED');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(orgStore.get('org-123').plan).toBe('PRO');

    const userVisibleNotifs = await service.getNotifications('org-123');
    expect(userVisibleNotifs).toEqual([]);
    expect(notifStore.map((n) => n.type)).toEqual(['WOMPI_TX_tx-100']);
  });

  it('4. guarantees idempotency across duplicate webhooks, concurrent requests, and simulated server restarts without extending subscription twice', async () => {
    orgStore.set('org-123', { id: 'org-123', name: 'Org 123', plan: 'FREE', planExpiresAt: null });

    const { body, checksum } = buildSignedWompiEvent({
      id: 'tx-concurrent-1',
      reference: 'UPG-PRO-org-123-1700000000001',
    });

    const [resA, resB] = await Promise.all([
      service.handleWebhook(body, checksum),
      service.handleWebhook(body, checksum),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual(['ALREADY_PROCESSED', 'UPGRADED']);

    const expiresAfterFirst = orgStore.get('org-123').planExpiresAt.getTime();
    expect(mailService.sendPaymentSuccessEmail).toHaveBeenCalledTimes(1);

    const restartedService = new BillingService(prisma, mailService as any);
    const resAfterRestart = await restartedService.handleWebhook(body, checksum);

    expect(resAfterRestart.status).toBe('ALREADY_PROCESSED');
    expect(orgStore.get('org-123').planExpiresAt.getTime()).toBe(expiresAfterFirst);
    expect(mailService.sendPaymentSuccessEmail).toHaveBeenCalledTimes(1);
  });

  it('5. allows a subsequent distinct transaction (tx-2) for the same organization to renew/extend PRO by +30 days', async () => {
    orgStore.set('org-123', { id: 'org-123', name: 'Org 123', plan: 'FREE', planExpiresAt: null });

    const ev1 = buildSignedWompiEvent({
      id: 'tx-month-1',
      reference: 'UPG-PRO-org-123-1700000000010',
    });
    const firstRes = await service.handleWebhook(ev1.body, ev1.checksum);
    expect(firstRes.status).toBe('UPGRADED');
    const firstExpiration = orgStore.get('org-123').planExpiresAt as Date;

    const ev2 = buildSignedWompiEvent({
      id: 'tx-month-2',
      reference: 'UPG-PRO-org-123-1700000000020',
    });
    const secondRes = await service.handleWebhook(ev2.body, ev2.checksum);
    expect(secondRes.status).toBe('UPGRADED');
    const secondExpiration = orgStore.get('org-123').planExpiresAt as Date;

    const diffDays = Math.round(
      (secondExpiration.getTime() - firstExpiration.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(diffDays).toBe(30);
    expect(notifStore.map((n) => n.type)).toEqual(['WOMPI_TX_tx-month-1', 'WOMPI_TX_tx-month-2']);
  });

  it('6. validates official checksum, currency COP, amount 4500000, and rejects PENDING/DECLINED or untraceable references', async () => {
    orgStore.set('org-123', { id: 'org-123', name: 'Org 123', plan: 'FREE', planExpiresAt: null });

    for (const status of ['PENDING', 'DECLINED', 'ERROR', 'VOIDED']) {
      const ev = buildSignedWompiEvent({ id: `tx-${status}`, status });
      const res = await service.handleWebhook(ev.body, ev.checksum);
      expect(res).toEqual({ success: true, status });
    }

    const untraceableEv = buildSignedWompiEvent({
      id: 'tx-untraceable',
      reference: 'sjlOgz_12345',
    });
    const untraceable = await service.handleWebhook(untraceableEv.body, untraceableEv.checksum);
    expect(untraceable).toEqual({
      success: true,
      message: 'Referencia no corresponde a upgrade',
    });

    const badCurrencyEv = buildSignedWompiEvent({
      id: 'tx-usd',
      currency: 'USD',
    });
    await expect(service.handleWebhook(badCurrencyEv.body, badCurrencyEv.checksum)).rejects.toThrow(
      BadRequestException,
    );

    const badAmountEv = buildSignedWompiEvent({
      id: 'tx-bad-amount',
      amount_in_cents: 10000,
    });
    await expect(service.handleWebhook(badAmountEv.body, badAmountEv.checksum)).rejects.toThrow(
      BadRequestException,
    );

    const badSigEv = buildSignedWompiEvent({ id: 'tx-bad-sig' });
    await expect(service.handleWebhook(badSigEv.body, 'invalid_checksum_0000')).rejects.toThrow(
      BadRequestException,
    );

    expect(orgStore.get('org-123').plan).toBe('FREE');
  });

  it('7. protects AGENCY organizations from checkout or webhook overwrite', async () => {
    orgStore.set('8459742f-93e8-437d-a47d-aa6185719bd2', {
      id: '8459742f-93e8-437d-a47d-aa6185719bd2',
      name: 'Empresa Comercial',
      plan: 'AGENCY',
      planExpiresAt: null,
    });

    await expect(
      service.createCheckout('8459742f-93e8-437d-a47d-aa6185719bd2', 'PRO'),
    ).rejects.toThrow(BadRequestException);

    const agencyEv = buildSignedWompiEvent({
      id: 'tx-agency',
      reference: 'UPG-PRO-8459742f-93e8-437d-a47d-aa6185719bd2-1700000000000',
    });
    const webhookRes = await service.handleWebhook(agencyEv.body, agencyEv.checksum);

    expect(webhookRes.status).toBe('AGENCY_PRESERVED');
    expect(orgStore.get('8459742f-93e8-437d-a47d-aa6185719bd2').plan).toBe('AGENCY');
    expect(orgStore.get('8459742f-93e8-437d-a47d-aa6185719bd2').planExpiresAt).toBeNull();
  });
});
