import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum ItemType {
  BOOK = 'book',
  MAGAZINE = 'magazine',
  EQUIPMENT = 'equipment',
}

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true, length: 32 })
  code: string; // ej: BK-0042

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'enum', enum: ItemType })
  type: ItemType;

  @Column({ default: true })
  isActive: boolean; // false = soft deleted

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
