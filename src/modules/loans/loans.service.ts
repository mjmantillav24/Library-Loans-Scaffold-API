import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Loan, LoanStatus } from './entities/loan.entity';
import { Item } from '../items/entities/item.entity';
import { User } from '../auth/entities/user.entity';
import { CreateLoanDto } from './dto/create-loans.dto';

// Transiciones válidas de la máquina de estados (FSM)
const ALLOWED_TRANSITIONS: Partial<Record<LoanStatus, LoanStatus[]>> = {
  [LoanStatus.ACTIVE]: [LoanStatus.RETURNED, LoanStatus.LOST, LoanStatus.OVERDUE],
  [LoanStatus.OVERDUE]: [LoanStatus.RETURNED, LoanStatus.LOST],
  [LoanStatus.RETURNED]: [], // terminal
  [LoanStatus.LOST]: [], // terminal
};

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan) private loanRepo: Repository<Loan>,
    @InjectRepository(Item) private itemRepo: Repository<Item>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private config: ConfigService,
  ) {}

  async create(dto: CreateLoanDto): Promise<Loan> {
    const loanedAt = new Date();
    const dueAt = new Date(dto.dueAt);

    // R1 — Validación de fechas
    if (dueAt <= loanedAt) {
      throw new BadRequestException('dueAt debe ser mayor que la fecha actual');
    }
    const maxLoanDays = this.config.get<number>('loans.maxLoanDays', 30);
    const maxMs = maxLoanDays * 24 * 60 * 60 * 1000;
    if (dueAt.getTime() - loanedAt.getTime() > maxMs) {
      throw new BadRequestException(`La ventana máxima de préstamo es ${maxLoanDays} días`);
    }

    // Verificar que el item existe
    const item = await this.itemRepo.findOne({ where: { id: dto.itemId, isActive: true } });
    if (!item) throw new NotFoundException(`Item ${dto.itemId} no encontrado`);

    // R2 — Item disponible: no debe tener préstamo active u overdue
    const activeLoan = await this.loanRepo.findOne({
      where: [
        { itemId: dto.itemId, status: LoanStatus.ACTIVE },
        { itemId: dto.itemId, status: LoanStatus.OVERDUE },
      ],
    });
    if (activeLoan) {
      throw new ConflictException(
        `El item ya está prestado (loanId: ${activeLoan.id})`
      );
    }

    // Verificar que el usuario existe
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`Usuario ${dto.userId} no encontrado`);

    // R3 — Límite de préstamos activos por usuario
    const maxLoans = this.config.get<number>('loans.maxActivePerUser', 3);
    const activeCount = await this.loanRepo.count({
      where: [
        { userId: dto.userId, status: LoanStatus.ACTIVE },
        { userId: dto.userId, status: LoanStatus.OVERDUE },
      ],
    });
    if (activeCount >= maxLoans) {
      throw new ConflictException(
        `El usuario ya tiene ${maxLoans} préstamos activos (límite alcanzado)`
      );
    }

    const loan = this.loanRepo.create({
      userId: dto.userId,
      itemId: dto.itemId,
      loanedAt,
      dueAt,
      status: LoanStatus.ACTIVE,
    });

    return this.loanRepo.save(loan);
  }

  async findAll(filters: { userId?: string; itemId?: string; status?: LoanStatus }) {
    const query = this.loanRepo.createQueryBuilder('loan');

    if (filters.userId)  query.andWhere('loan.userId = :userId',   { userId: filters.userId });
    if (filters.itemId)  query.andWhere('loan.itemId = :itemId',   { itemId: filters.itemId });
    if (filters.status)  query.andWhere('loan.status = :status',   { status: filters.status });

    return query.getMany();
  }

  async findOne(id: string): Promise<Loan> {
    const loan = await this.loanRepo.findOne({ where: { id } });
    if (!loan) throw new NotFoundException(`Préstamo ${id} no encontrado`);
    return loan;
  }

  async returnLoan(id: string): Promise<Loan> {
    const loan = await this.findOne(id);

    // R5 — FSM: solo active u overdue pueden devolverse
    if (loan.status === LoanStatus.RETURNED || loan.status === LoanStatus.LOST) {
      throw new BadRequestException(
        `No se puede devolver un préstamo con estado '${loan.status}'`
      );
    }

    const returnedAt = new Date();
    const dailyRate = this.config.get<number>('loans.dailyFineRate', 0.50);


    // R4 — Cálculo de multa con Math.ceil (1 minuto tarde = 1 día de multa)
    const msPerDay = 24 * 60 * 60 * 1000;
    const msOverdue = returnedAt.getTime() - loan.dueAt.getTime();
    const daysOverdue = Math.max(0, Math.ceil(msOverdue / msPerDay));
    const fineAmount = parseFloat((daysOverdue * dailyRate).toFixed(2));

    loan.returnedAt = returnedAt;
    loan.status = LoanStatus.RETURNED;
    loan.fineAmount = fineAmount;

    return this.loanRepo.save(loan);
  }

  async markLost(id: string): Promise<Loan> {
    const loan = await this.findOne(id);

    // R5 — Solo active u overdue pueden marcarse como lost
    const allowed = ALLOWED_TRANSITIONS[loan.status] ?? [];
    if (!allowed.includes(LoanStatus.LOST)) {
      throw new BadRequestException(
        `Transición inválida: ${loan.status} → lost`
      );
    }

    loan.status = LoanStatus.LOST;
    return this.loanRepo.save(loan);
  }
}