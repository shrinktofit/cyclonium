import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({
  path: [
    resolve(import.meta.dirname, '../../../.env'),
    resolve(import.meta.dirname, '../../../.env.local'),
  ],
});

export {};
