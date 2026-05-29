import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item, ItemType } from './entities/item.entity';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item) private itemRepo: Repository<Item>,
    @InjectRepository(Loan) private loanRepo: Repository<Loan>,
  ) {}

  async create(dto: CreateItemDto): Promise<Item> {
    const item = this.itemRepo.create(dto);
    return this.itemRepo.save(item);
  }

  async findAll(type?: ItemType) {
    const query = this.itemRepo.createQueryBuilder('item')
      .where('item.isActive = :active', { active: true });

    if (type) query.andWhere('item.type = :type', { type });

    const items = await query.getMany();

    // Calcular isAvailable para cada item
    return Promise.all(items.map(async item => ({
      ...item,
      isAvailable: await this.isAvailable(item.id),
    })));
  }

  async findOne(id: string) {
    const item = await this.itemRepo.findOne({ where: { id, isActive: true } });
    if (!item) throw new NotFoundException(`Item ${id} no encontrado`);
    return { ...item, isAvailable: await this.isAvailable(item.id) };
  }

  async update(id: string, dto: UpdateItemDto) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    item.isActive = false;     // soft delete: solo marcamos como inactivo
    await this.itemRepo.save(item);
  }

  // Helper: ¿tiene un préstamo activo u overdue?
  async isAvailable(itemId: string): Promise<boolean> {
    const activeLoan = await this.loanRepo.findOne({
      where: [
        { itemId, status: LoanStatus.ACTIVE },
        { itemId, status: LoanStatus.OVERDUE },
      ],
    });
    return !activeLoan;
  }
}
