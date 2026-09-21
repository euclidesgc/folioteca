import { execSync } from 'node:child_process';
import path from 'node:path';

const apiRoot = path.resolve(import.meta.dirname, '..');

export default function setup(): void {
  process.env.DATABASE_URL ??=
    'postgresql://folioteca@localhost:5433/folioteca_test';

  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  });
}
