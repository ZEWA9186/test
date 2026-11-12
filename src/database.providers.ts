import { TypeOrmModule } from '@nestjs/typeorm';
const host = process.env.DB_HOST; /* || 'localhost' */
const port = Number(process.env.DB_PORT); /* || 5432 */
const username = process.env.DB_USERNAME; /* || 'postgres' */
const password = process.env.DB_PASSWORD; /* || 'termet' */
const database = process.env.DB_DATABASE; /* || 'test1' */
export const DatabaseProviders = TypeOrmModule.forRoot({
  type: 'postgres',
  host: host ?? 'localhost',
  port: port ?? 5434,
  username: username ?? 'postgres',
  password: password ?? '123',
  database: database ?? 'server_trial_db',
  autoLoadEntities: true,
  synchronize: true,
});
