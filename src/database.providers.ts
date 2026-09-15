import { TypeOrmModule } from '@nestjs/typeorm';

export const DatabaseProviders = TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'termet',
  database: 'CODES',
  autoLoadEntities: true,
  synchronize: false,

  // === Пул соединений ===
  extra: {
    max: 20, // максимум соединений
    min: 5, // держать минимум "тёплых"
    idleTimeoutMillis: 30000, // не закрывать слишком рано
    connectionTimeoutMillis: 5000,
    keepAlive: true, // TCP keepalive
    statement_timeout: 30000,
  },
});
