import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { Item } from '../items/entities/item.entity';
import { User } from '../auth/entities/user.entity';
import { Loan } from '@modules/loans/entities/loan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Loan, Item, User]),
    // Necesitamos Item para verificar que existe y que está activo (R2)
    // Necesitamos User para verificar que el usuario existe (R3)
  ],
  providers: [LoansService],
  controllers: [LoansController],
})
export class LoansModule {}
