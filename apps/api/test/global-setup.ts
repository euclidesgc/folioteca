import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const apiRoot = path.resolve(import.meta.dirname, '..');

export default function setup(): void {
  process.env.DATABASE_URL ??=
    'postgresql://folioteca@localhost:5433/folioteca_test';

  // Sem código de instalação os testes não conseguiriam instalar a instância.
  process.env.INSTALL_CODE ??= randomBytes(24).toString('base64url');

  // Debounce curto: os testes esperam a gravação do conteúdo acontecer.
  process.env.COLLAB_STORE_DEBOUNCE_MS ??= '50';

  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  });
}
