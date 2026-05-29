import {
  Injectable, ConflictException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Verificar que el email no existe ya
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('El email ya está registrado');

    // Hashear la contraseña — NUNCA guardar en texto plano
    const saltRounds = this.config.get<number>('bcrypt.saltRounds', 10);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      // role queda en 'member' por defecto (definido en la entidad)
    });

    const saved = await this.userRepo.save(user);
    const accessToken = this.generateToken(saved);
    return { accessToken, user: saved }; // passwordHash excluido por @Exclude()
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Credenciales inválidas');

    if (!user.isActive) throw new UnauthorizedException('Usuario inactivo');

    const accessToken = this.generateToken(user);
    return { accessToken, user };
  }

  private generateToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }
}
