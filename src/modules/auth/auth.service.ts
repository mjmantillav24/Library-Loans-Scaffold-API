import {
  Injectable, ConflictException, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private refreshTokenRepo: Repository<RefreshToken>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('El email ya está registrado');

    const saltRounds = this.config.get<number>('bcrypt.saltRounds', 10);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    const saved = await this.userRepo.save(user);
    const accessToken = this.generateAccessToken(saved);
    const refreshToken = await this.createRefreshToken(saved.id);
    return { accessToken, refreshToken, user: saved };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Credenciales inválidas');

    if (!user.isActive) throw new UnauthorizedException('Usuario inactivo');

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);
    return { accessToken, refreshToken, user };
  }

  async refresh(token: string): Promise<{ accessToken: string }> {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');

    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(token, { secret: refreshSecret });
    } catch {
      throw new ForbiddenException('Refresh token inválido o expirado');
    }

    const stored = await this.refreshTokenRepo.findOne({ where: { token } });
    if (!stored) throw new ForbiddenException('Refresh token no encontrado');
    if (stored.revokedAt) throw new ForbiddenException('Refresh token revocado');
    if (stored.expiresAt < new Date()) throw new ForbiddenException('Refresh token expirado');

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');

    return { accessToken: this.generateAccessToken(user) };
  }

  async logout(token: string): Promise<void> {
    const stored = await this.refreshTokenRepo.findOne({ where: { token } });
    if (!stored) throw new ForbiddenException('Refresh token no encontrado');

    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);
  }

  private generateAccessToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn', '7d');

    const token = this.jwtService.sign(
      { sub: userId },
      { secret: refreshSecret, expiresIn: refreshExpiresIn },
    );

    const decoded = this.jwtService.decode(token) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    const rt = this.refreshTokenRepo.create({ userId, token, expiresAt });
    await this.refreshTokenRepo.save(rt);

    return token;
  }
}
