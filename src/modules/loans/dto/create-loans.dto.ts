import { IsUUID, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLoanDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ example: '2026-06-15T00:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  dueAt: string; // string porque viene del JSON, lo convertimos en el service
}
