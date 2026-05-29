import appConfig from './config/configuration';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { ItemsModule } from './modules/items/items.module';
import { LoansModule } from './modules/loans/loans.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { User } from './modules/auth/entities/user.entity';
import { Item } from './modules/items/entities/item.entity';
import { Loan } from './modules/loans/entities/loan.entity';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    // Usa el config y validación Joi del scaffold
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        synchronize: config.get<boolean>('DB_SYNCHRONIZE', false),
        logging: config.get<boolean>('DB_LOGGING', false),
        entities: [User, Item, Loan],
        migrations: ['dist/database/migrations/*.js'],
      }),
    }),
    AuthModule,
    ItemsModule,
    LoansModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule {}
