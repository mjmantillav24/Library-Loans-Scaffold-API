import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ItemType } from '../entities/item.entity';

export class CreateItemDto {
  @ApiProperty({ example: 'BK-0042' })
  @IsString() @IsNotEmpty() @MaxLength(32)
  code: string;

  @ApiProperty({ example: 'Don Quijote de la Mancha' })
  @IsString() @IsNotEmpty() @MaxLength(255)
  title: string;

  @ApiProperty({ enum: ItemType })
  @IsEnum(ItemType)
  type: ItemType;
}
