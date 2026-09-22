import { TypeOrmModule } from '@nestjs/typeorm';

export const DatabaseProviders = TypeOrmModule.forRoot({
    type: 'postgres',
    host: 'localhost',
    port: 5434,
    username: 'postgres',
    password: '123',
    database: 'server_trial_db',
    autoLoadEntities: true,
    synchronize: false,
});