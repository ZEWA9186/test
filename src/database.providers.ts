import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const DatabaseProviders = TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<number>('DB_PORT')) || 5432,
        username: configService.get<string>('DB_USER'),
        password: String(configService.get<string>('DB_PASSWORD') ?? ''),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
    }),
});