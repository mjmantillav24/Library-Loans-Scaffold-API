import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { LoansService } from './loans.service';
import { Loan, LoanStatus } from './entities/loan.entity';
import { Item } from '../items/entities/item.entity';
import { User } from '../auth/entities/user.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('LoansService', () => {
  let service: LoansService;
  let loanRepo: ReturnType<typeof mockRepo>;
  let itemRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: getRepositoryToken(Loan), useFactory: mockRepo },
        { provide: getRepositoryToken(Item), useFactory: mockRepo },
        { provide: getRepositoryToken(User), useFactory: mockRepo },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              const vals: Record<string, any> = {
                'loans.maxActivePerUser': 3,
                'loans.dailyFineRate': 0.50,
                'loans.maxLoanDays': 30,
              };
              return vals[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    loanRepo = module.get(getRepositoryToken(Loan));
    itemRepo = module.get(getRepositoryToken(Item));
    userRepo = module.get(getRepositoryToken(User));
  });

  it('crea préstamo cuando item disponible y usuario bajo el límite', async () => {
    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    itemRepo.findOne.mockResolvedValue({ id: 'item-1', isActive: true });
    loanRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });
    loanRepo.count.mockResolvedValue(0);
    loanRepo.create.mockReturnValue({ id: 'loan-new' });
    loanRepo.save.mockResolvedValue({ id: 'loan-new', status: LoanStatus.ACTIVE });

    const result = await service.create({ userId: 'user-1', itemId: 'item-1', dueAt });
    expect(result.status).toBe(LoanStatus.ACTIVE);
  });

  it('lanza ConflictException si el item ya tiene préstamo activo (R2)', async () => {
    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    itemRepo.findOne.mockResolvedValue({ id: 'item-1', isActive: true });
    loanRepo.findOne.mockResolvedValue({ id: 'loan-existing', status: LoanStatus.ACTIVE });

    await expect(
      service.create({ userId: 'user-1', itemId: 'item-1', dueAt })
    ).rejects.toThrow(ConflictException);
  });

  it('lanza ConflictException si el usuario ya tiene 3 préstamos activos (R3)', async () => {
    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    itemRepo.findOne.mockResolvedValue({ id: 'item-2', isActive: true });
    loanRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });
    loanRepo.count.mockResolvedValue(3);

    await expect(
      service.create({ userId: 'user-1', itemId: 'item-2', dueAt })
    ).rejects.toThrow(ConflictException);
  });

  it('calcula fineAmount = 2.50 cuando se devuelve 5 días tarde (R4)', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const existingLoan: Partial<Loan> = {
      id: 'loan-1',
      status: LoanStatus.ACTIVE,
      dueAt: fiveDaysAgo,
    };

    loanRepo.findOne.mockResolvedValue(existingLoan);
    loanRepo.save.mockImplementation(async (l) => l);

    const result = await service.returnLoan('loan-1');
    expect(result.fineAmount).toBe(2.50);
    expect(result.status).toBe(LoanStatus.RETURNED);
  });
});
