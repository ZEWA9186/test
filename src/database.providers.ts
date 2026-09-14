import { TypeOrmModule } from '@nestjs/typeorm';

export const DatabaseProviders = TypeOrmModule.forRoot({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'termet',
    database: 'postgres',
    autoLoadEntities: true,
    synchronize: false,
});