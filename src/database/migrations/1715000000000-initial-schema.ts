import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1715000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums primero
    await queryRunner.query(`
      CREATE TYPE user_role_enum AS ENUM ('admin', 'librarian', 'member')
    `);
    await queryRunner.query(`
      CREATE TYPE item_type_enum AS ENUM ('book', 'magazine', 'equipment')
    `);
    await queryRunner.query(`
      CREATE TYPE loan_status_enum AS ENUM ('active', 'returned', 'overdue', 'lost')
    `);

    // Tabla users
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        "passwordHash" VARCHAR(255) NOT NULL,
        "firstName" VARCHAR(100) NOT NULL,
        "lastName" VARCHAR(100) NOT NULL,
        role user_role_enum NOT NULL DEFAULT 'member',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_users_email ON users(email)`);

    // Tabla items
    await queryRunner.query(`
      CREATE TABLE items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(32) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        type item_type_enum NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_items_code ON items(code)`);

    // Tabla loans
    await queryRunner.query(`
      CREATE TABLE loans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "itemId" UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
        "loanedAt" TIMESTAMPTZ NOT NULL,
        "dueAt" TIMESTAMPTZ NOT NULL,
        "returnedAt" TIMESTAMPTZ,
        status loan_status_enum NOT NULL DEFAULT 'active',
        "fineAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_loans_item_status ON loans("itemId", status)`);
    await queryRunner.query(`CREATE INDEX idx_loans_user_status ON loans("userId", status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS loans`);
    await queryRunner.query(`DROP TABLE IF EXISTS items`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TYPE IF EXISTS loan_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS item_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role_enum`);
  }
}
