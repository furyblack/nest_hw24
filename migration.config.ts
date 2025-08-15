import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { options } from './src/db/options';

config();
console.log('gggg', options);
export default new DataSource({
  url: 'postgres://postgres:3991@localhost:5433/blogger_platform',
  type: 'postgres',
  entities: ['src/moduls/**/*.entity.{ts,js}'],
  migrations: ['src/migrations/*.{ts,js}'],
  logging: true,
});
