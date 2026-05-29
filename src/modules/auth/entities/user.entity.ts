import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';

// Los 3 roles posibles del sistema
export enum UserRole {
  ADMIN = 'admin',
  LIBRARIAN = 'librarian',
  MEMBER = 'member',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()// índice para búsquedas rápidas por email
  @Column({ unique: true, length: 255 })
  email: string;

  @Exclude() // NUNCA se devuelve en respuestas HTTP
  @Column({ length: 255 })
  passwordHash: string;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.MEMBER })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
