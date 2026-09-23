import { beforeAll } from 'vitest';
import { getPool, setDbTestConfig } from '../src/client';
import { loadDbTestConfig } from '../src/env';

beforeAll(async () => {
  process.env.GROAURUM_DB_TEST_ALLOWED ??= 'true';
  setDbTestConfig(loadDbTestConfig());

  const pool = getPool();
  const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
  if (rows[0]?.ok !== 1) {
    throw new Error('Local PostgreSQL did not respond to health check.');
  }
});
