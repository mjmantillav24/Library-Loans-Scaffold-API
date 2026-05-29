import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Item } from '../../items/entities/item.entity';

export enum LoanStatus {
  ACTIVE = 'active',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
  LOST = 'lost',
}

@Index(['itemId', 'status']) // para verificar disponibilidad rápido
@Index(['userId', 'status']) // para contar préstamos activos por usuario
@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  itemId: string;

  @ManyToOne(() => Item, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @Column({ type: 'timestamptz' })
  loanedAt: Date;

  @Column({ type: 'timestamptz' })
  dueAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  returnedAt: Date | null;

  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.ACTIVE })
  status: LoanStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fineAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
