import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import type {
  Document,
  DocumentResponse,
  DocumentsResponse,
  UpdateDocumentBody,
} from '@/types/api';

import { getDb, type MockDocument } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

const DEFAULT_TITLE = 'Sem título';
const TITLE_MAX_LENGTH = 200;

// The fake database keeps documents without `isFavorite`; the body adds it.
const toDocumentBody = (document: MockDocument): Document => ({
  ...document,
  isFavorite: false,
});

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const notFound = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });

export const documentsHandlers = [
  http.post(`${env.API_URL}/documents`, async ({ cookies }) => {
    await networkDelay();
    const forced = await devOverride('documents');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation, documents } = getDb();
    if (!installation) return unauthenticated();

    const { person } = installation;
    const now = new Date().toISOString();
    const document: MockDocument = {
      id: crypto.randomUUID(),
      title: DEFAULT_TITLE,
      spaceId: `space-${person.id}`,
      authorId: person.id,
      ownerId: person.id,
      createdAt: now,
      updatedAt: now,
      accessLevel: 'owner',
    };
    documents.push(document);

    const body: DocumentResponse = { data: toDocumentBody(document) };
    return HttpResponse.json(body, { status: 201 });
  }),

  http.get(`${env.API_URL}/documents`, async ({ request, cookies }) => {
    await networkDelay();
    const forced = await devOverride('documents');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const scope = new URL(request.url).searchParams.get('scope');
    if (scope !== 'mine') {
      return HttpResponse.json(
        {
          message: 'Dados inválidos.',
          errors: [{ field: 'scope', message: 'Informe um escopo válido.' }],
        },
        { status: 400 },
      );
    }

    const { documents } = getDb();
    const list = [...documents]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 100)
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));

    const body: DocumentsResponse = { data: list };
    return HttpResponse.json(body);
  }),

  http.get(`${env.API_URL}/documents/:documentId`, async ({ params, cookies }) => {
    await networkDelay();
    const forced = await devOverride('documents');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { documents } = getDb();
    const document = documents.find((item) => item.id === params.documentId);
    if (!document) return notFound();

    const body: DocumentResponse = { data: toDocumentBody(document) };
    return HttpResponse.json(body);
  }),

  http.patch(
    `${env.API_URL}/documents/:documentId`,
    async ({ params, request, cookies }) => {
      await networkDelay();
      const forced = await devOverride('documents');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { documents } = getDb();
      const document = documents.find((item) => item.id === params.documentId);
      if (!document) return notFound();

      const requestBody = (await request.json()) as Partial<UpdateDocumentBody>;
      if (typeof requestBody.title !== 'string') {
        return HttpResponse.json(
          {
            message: 'Dados inválidos.',
            errors: [{ field: 'title', message: 'Informe o título.' }],
          },
          { status: 400 },
        );
      }

      const trimmed = requestBody.title.trim();
      if (trimmed.length > TITLE_MAX_LENGTH) {
        return HttpResponse.json(
          {
            message: 'Dados inválidos.',
            errors: [
              {
                field: 'title',
                message: 'O título pode ter no máximo 200 caracteres.',
              },
            ],
          },
          { status: 400 },
        );
      }

      document.title = trimmed === '' ? DEFAULT_TITLE : trimmed;
      document.updatedAt = new Date().toISOString();

      const body: DocumentResponse = { data: toDocumentBody(document) };
      return HttpResponse.json(body);
    },
  ),
];
