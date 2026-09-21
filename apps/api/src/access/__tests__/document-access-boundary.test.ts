import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Teste estrutural das portas de acesso (D4): a tabela `Document` só é tocada
 * pelo módulo `access` e pelo módulo `documents`, toda leitura de lista passa
 * por `readableDocumentsWhere` e toda gravação mora no serviço.
 */

type Violation = {
  file: string;
  line: number;
  message: string;
};

type SourceFile = {
  /** Caminho relativo a `apps/api/src`, com barras normais. */
  file: string;
  source: string;
};

const srcRoot = path.resolve(import.meta.dirname, '../..');

const READ_METHODS = ['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'];
const WRITE_METHODS = ['update', 'updateMany', 'delete', 'deleteMany'];

const DOCUMENT_TABLE_PATTERN = /\.document\s*\./g;
const RAW_QUERY_PATTERN = /\$(?:queryRaw|executeRaw)(?:Unsafe)?/g;
const FIND_UNIQUE_PATTERN = /\.document\.findUnique\s*\(/g;
const READ_CALL_PATTERN = new RegExp(
  `\\.document\\.(${READ_METHODS.join('|')})\\s*\\(`,
  'g',
);
const WRITE_CALL_PATTERN = new RegExp(
  `\\.document\\.(${WRITE_METHODS.join('|')})\\s*\\(`,
  'g',
);

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Índice do parêntese que fecha a chamada aberta em `openIndex`. */
function endOfCall(source: string, openIndex: number): number {
  let depth = 0;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];

    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return source.length;
}

function isInsideGates(file: string): boolean {
  return file.startsWith('access/') || file.startsWith('documents/');
}

/** Regra 1: fora de `access/` e `documents/` ninguém toca em `Document`. */
function checkOutsideGates({ file, source }: SourceFile): Violation[] {
  const violations: Violation[] = [];

  for (const match of source.matchAll(DOCUMENT_TABLE_PATTERN)) {
    violations.push({
      file,
      line: lineAt(source, match.index),
      message: 'toca na tabela Document fora de access/ e documents/',
    });
  }

  for (const match of source.matchAll(RAW_QUERY_PATTERN)) {
    const statementEnd = source.indexOf(';', match.index);
    const statement = source.slice(
      match.index,
      statementEnd === -1 ? source.length : statementEnd,
    );

    if (statement.includes('"Document"')) {
      violations.push({
        file,
        line: lineAt(source, match.index),
        message: 'consulta crua na tabela "Document" fora de access/ e documents/',
      });
    }
  }

  return violations;
}

/** Regra 2: em `documents/`, nada de `findUnique` e leitura só com a porta. */
function checkDocumentsReads({ file, source }: SourceFile): Violation[] {
  const violations: Violation[] = [];

  for (const match of source.matchAll(FIND_UNIQUE_PATTERN)) {
    violations.push({
      file,
      line: lineAt(source, match.index),
      message: 'usa document.findUnique, que passa por cima das portas',
    });
  }

  for (const match of source.matchAll(READ_CALL_PATTERN)) {
    const openIndex = match.index + match[0].length - 1;
    const call = source.slice(openIndex, endOfCall(source, openIndex) + 1);

    if (!call.includes('readableDocumentsWhere(')) {
      violations.push({
        file,
        line: lineAt(source, match.index),
        message: `document.${match[1]} sem readableDocumentsWhere`,
      });
    }
  }

  return violations;
}

/** Regra 3: em `documents/`, gravação só em `documents.service.ts`. */
function checkDocumentsWrites({ file, source }: SourceFile): Violation[] {
  const violations: Violation[] = [];

  if (file === 'documents/documents.service.ts') {
    return violations;
  }

  for (const match of source.matchAll(WRITE_CALL_PATTERN)) {
    violations.push({
      file,
      line: lineAt(source, match.index),
      message: `document.${match[1]} fora de documents.service.ts`,
    });
  }

  return violations;
}

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : listSourceFiles(full);
    }

    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

const sourceFiles: SourceFile[] = listSourceFiles(srcRoot).map((full) => ({
  file: path.relative(srcRoot, full).split(path.sep).join('/'),
  source: readFileSync(full, 'utf8'),
}));

const documentsFiles = sourceFiles.filter(({ file }) =>
  file.startsWith('documents/'),
);

function report(violations: Violation[]): string[] {
  return violations.map(
    (violation) =>
      `${violation.file}:${violation.line} ${violation.message}`,
  );
}

test('no source file outside access and documents touches the document table', () => {
  const violations = sourceFiles
    .filter(({ file }) => !isInsideGates(file))
    .flatMap(checkOutsideGates);

  expect(sourceFiles.length).toBeGreaterThan(0);
  expect(report(violations)).toEqual([]);
});

test('the documents module never calls document.findUnique', () => {
  const violations = documentsFiles
    .flatMap(checkDocumentsReads)
    .filter((violation) => violation.message.includes('findUnique'));

  expect(documentsFiles.length).toBeGreaterThan(0);
  expect(report(violations)).toEqual([]);
});

test('every document read in the documents module goes through readableDocumentsWhere', () => {
  const violations = documentsFiles
    .flatMap(checkDocumentsReads)
    .filter((violation) => violation.message.includes('readableDocumentsWhere'));

  expect(report(violations)).toEqual([]);
});

test('document writes only happen in documents.service.ts', () => {
  const violations = documentsFiles.flatMap(checkDocumentsWrites);

  expect(report(violations)).toEqual([]);
});

test('rule 1 flags a sample offender and accepts a sample compliant snippet', () => {
  const offender = checkOutsideGates({
    file: 'health/health.service.ts',
    source: [
      'const total = await this.prisma.document.count();',
      'await this.prisma.$queryRaw`SELECT id FROM "Document"`;',
    ].join('\n'),
  });

  const compliant = checkOutsideGates({
    file: 'health/health.service.ts',
    source: [
      'const total = await this.prisma.person.count();',
      'await this.prisma.$queryRaw`SELECT id FROM "Person"`;',
    ].join('\n'),
  });

  expect(report(offender)).toEqual([
    'health/health.service.ts:1 toca na tabela Document fora de access/ e documents/',
    'health/health.service.ts:2 consulta crua na tabela "Document" fora de access/ e documents/',
  ]);
  expect(report(compliant)).toEqual([]);
});

test('rule 2 flags a sample offender and accepts a sample compliant snippet', () => {
  const offender = checkDocumentsReads({
    file: 'documents/documents.service.ts',
    source: [
      'await this.prisma.document.findUnique({ where: { id } });',
      'await this.prisma.document.findMany({ where: { ownerId: personId } });',
    ].join('\n'),
  });

  const compliant = checkDocumentsReads({
    file: 'documents/documents.service.ts',
    source:
      'await this.prisma.document.findMany({ where: this.access.readableDocumentsWhere(personId) });',
  });

  expect(report(offender)).toEqual([
    'documents/documents.service.ts:1 usa document.findUnique, que passa por cima das portas',
    'documents/documents.service.ts:2 document.findMany sem readableDocumentsWhere',
  ]);
  expect(report(compliant)).toEqual([]);
});

test('rule 3 flags a sample offender and accepts a sample compliant snippet', () => {
  const source =
    'await this.prisma.document.update({ where: { id }, data: { title } });';

  const offender = checkDocumentsWrites({
    file: 'documents/documents.controller.ts',
    source,
  });

  const compliant = checkDocumentsWrites({
    file: 'documents/documents.service.ts',
    source,
  });

  expect(report(offender)).toEqual([
    'documents/documents.controller.ts:1 document.update fora de documents.service.ts',
  ]);
  expect(report(compliant)).toEqual([]);
});
