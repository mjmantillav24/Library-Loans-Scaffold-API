import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { Item } from './entities/item.entity';
import { Loan } from '../loans/entities/loan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, Loan]),
    // Necesitamos Loan aquí porque ItemsService consulta si hay préstamos activos
    // para calcular isAvailable
  ],
  providers: [ItemsService],
  controllers: [ItemsController],
  exports: [TypeOrmModule], // exporta para que LoansModule pueda usar ItemRepo
})
export class ItemsModule {}
