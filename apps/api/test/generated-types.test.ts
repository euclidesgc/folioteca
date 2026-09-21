import fs from 'node:fs/promises';
import path from 'node:path';

import openapiTS, { astToString } from 'openapi-typescript';

const openapiYamlPath = path.resolve(
  import.meta.dirname,
  '../../../packages/api-contract/openapi.yaml',
);
const generatedTypesPath = path.resolve(
  import.meta.dirname,
  '../../../packages/api-contract/src/generated/openapi.d.ts',
);

test('generated types match the openapi contract', async () => {
  const ast = await openapiTS(new URL(`file://${openapiYamlPath}`));
  const regenerated = astToString(ast).trim();

  const versioned = await fs.readFile(generatedTypesPath, 'utf-8');
  const versionedBody = versioned
    .replace(/^\/\*\*[\s\S]*?\*\/\n/, '')
    .trim();

  expect(regenerated).toBe(versionedBody);
});
