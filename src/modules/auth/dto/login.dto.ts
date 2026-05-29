import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'juan@biblioteca.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MiPassword123' })
  @IsString()
  @MinLength(8)
  password: string;
}
