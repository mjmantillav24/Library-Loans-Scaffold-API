import { IsString, IsEnum, MaxLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ItemType } from '../entities/item.entity';

export class UpdateItemDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: ItemType })
  @IsOptional() @IsEnum(ItemType)
  type?: ItemType;
}
