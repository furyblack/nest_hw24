import { DataSourceOptions } from 'typeorm';

export const options: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5433'),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? '3991',
  database: process.env.DB_NAME ?? 'blogger_platform',
  synchronize: false,
  logging: false,
};
