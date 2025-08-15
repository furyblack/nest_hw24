import { join } from 'path';

export const envFilePaths = [
  process.env.ENV_FILE_PATH?.trim() || '',
  join(__dirname, `env`, `.env.${process.env.NODE_ENV}.local`),
  join(__dirname, `env`, `.env.${process.env.NODE_ENV}`),
  join(__dirname, `env`, `.env.production`),
];
