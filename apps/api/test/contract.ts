import path from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const openapiPath = path.resolve(
  import.meta.dirname,
  '../../../packages/api-contract/openapi.yaml',
);

export type ExpectMatchesContractArgs = {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  status: number;
  body: unknown;
};

type ContractResponse = {
  content?: {
    'application/json'?: { schema?: object };
  };
};

type ContractOperation = {
  responses?: Record<string, ContractResponse>;
};

type ContractPathItem = Partial<
  Record<ExpectMatchesContractArgs['method'], ContractOperation>
>;

type ContractDocument = {
  paths?: Record<string, ContractPathItem>;
};

let dereferencedDocumentCache: Promise<ContractDocument> | undefined;

function getDereferencedDocument(): Promise<ContractDocument> {
  dereferencedDocumentCache ??= SwaggerParser.dereference(
    openapiPath,
  ) as Promise<ContractDocument>;

  return dereferencedDocumentCache;
}

export async function expectMatchesContract({
  path: requestPath,
  method,
  status,
  body,
}: ExpectMatchesContractArgs): Promise<void> {
  const document = await getDereferencedDocument();

  const pathItem = document.paths?.[requestPath];

  if (!pathItem) {
    throw new Error(
      `O contrato não define o caminho "${requestPath}".`,
    );
  }

  const operation = pathItem[method];

  if (!operation) {
    throw new Error(
      `O contrato não define o método "${method}" para "${requestPath}".`,
    );
  }

  const response = operation.responses?.[String(status)];

  if (!response) {
    throw new Error(
      `O contrato não define o status ${status} para "${method.toUpperCase()} ${requestPath}".`,
    );
  }

  const schema = response.content?.['application/json']?.schema;

  if (!schema) {
    throw new Error(
      `O contrato não define um schema JSON para o status ${status} de "${method.toUpperCase()} ${requestPath}".`,
    );
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const isValid = validate(body);

  if (!isValid) {
    const errors = JSON.stringify(validate.errors, null, 2);

    throw new Error(
      `O corpo não corresponde ao contrato de "${method.toUpperCase()} ${requestPath}" (${status}): ${errors}`,
    );
  }
}
