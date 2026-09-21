import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import type { OrgUnitResponse, OrgUnitsResponse } from '@/types/api';

import { addOrgUnit, getDb, type MockOrgUnit, renameOrgUnit } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

const ORG_UNIT_NAME_MAX_LENGTH = 120;

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const forbidden = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Apenas a administração pode fazer isso.' },
    { status: 403 },
  );

const notFound = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Unidade não encontrada.' }, { status: 404 });

const conflict = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Já existe uma unidade com esse nome neste nível.' },
    { status: 409 },
  );

const invalid = (
  field: string,
  message: string,
): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Dados inválidos.', errors: [{ field, message }] },
    { status: 400 },
  );

// Same treatment the API gives the name: trimmed and normalized to NFC, so
// "Área" typed decomposed is stored composed.
const normalizeName = (name: string): string => name.trim().normalize('NFC');

// The API rejects the body with a strict schema: any key it does not know
// (including `parentId` on the PATCH) is refused.
const unknownKey = (
  body: Record<string, unknown>,
  allowed: string[],
): string | undefined =>
  Object.keys(body).find((key) => !allowed.includes(key));

// The name as it will be stored, or the 400 to answer with.
const parseName = (
  value: unknown,
):
  | { name: string; response?: undefined }
  | { name?: undefined; response: ReturnType<typeof HttpResponse.json> } => {
  if (typeof value !== 'string') {
    return { response: invalid('name', 'Informe o nome.') };
  }

  const name = normalizeName(value);
  if (name.length === 0) {
    return { response: invalid('name', 'Informe o nome.') };
  }
  if (name.length > ORG_UNIT_NAME_MAX_LENGTH) {
    return {
      response: invalid('name', 'O nome pode ter no máximo 120 caracteres.'),
    };
  }

  return { name };
};

// Names collide by case, never by accent: "Acervo" and "acervo" are the same
// name, "Área" and "Area" are not. `exceptId` leaves the unit being renamed
// out of its own comparison.
const hasSiblingNamed = ({
  parentId,
  name,
  exceptId,
}: {
  parentId: string | null;
  name: string;
  exceptId?: string;
}): boolean =>
  getDb().orgUnits.some(
    (unit) =>
      unit.id !== exceptId &&
      unit.parentId === parentId &&
      unit.name.toLowerCase() === name.toLowerCase(),
  );

// Same ordering the API does in memory: pt-BR collator ignoring accents and
// case, with a deterministic tie-break by id.
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

const byName = (a: MockOrgUnit, b: MockOrgUnit): number =>
  collator.compare(a.name, b.name) || a.id.localeCompare(b.id);

export const orgUnitsHandlers = [
  http.get(`${env.API_URL}/org-units`, async ({ cookies }) => {
    await networkDelay();
    const forced = await devOverride('org-units');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation, orgUnits } = getDb();
    if (!installation) return unauthenticated();

    if (!installation.person.isAdmin) return forbidden();

    const body: OrgUnitsResponse = { data: [...orgUnits].sort(byName) };
    return HttpResponse.json(body);
  }),

  http.post(`${env.API_URL}/org-units`, async ({ request, cookies }) => {
    await networkDelay();
    const forced = await devOverride('org-units');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation, orgUnits } = getDb();
    if (!installation) return unauthenticated();
    if (!installation.person.isAdmin) return forbidden();

    const requestBody = (await request.json()) as Record<string, unknown>;

    const refused = unknownKey(requestBody, ['parentId', 'name']);
    if (refused) return invalid(refused, 'Campo não permitido.');

    if (typeof requestBody.parentId !== 'string') {
      return invalid('parentId', 'Informe a unidade mãe.');
    }
    const parsed = parseName(requestBody.name);
    if (parsed.response) return parsed.response;

    const { parentId } = requestBody;
    if (!orgUnits.some((unit) => unit.id === parentId)) return notFound();

    const { name } = parsed;
    if (hasSiblingNamed({ parentId, name })) return conflict();

    const body: OrgUnitResponse = { data: addOrgUnit({ parentId, name }) };
    return HttpResponse.json(body, { status: 201 });
  }),

  http.patch(
    `${env.API_URL}/org-units/:orgUnitId`,
    async ({ params, request, cookies }) => {
      await networkDelay();
      const forced = await devOverride('org-units');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { installation, orgUnits } = getDb();
      if (!installation) return unauthenticated();
      if (!installation.person.isAdmin) return forbidden();

      // The id is resolved before the body is validated, as the API does.
      const unit = orgUnits.find((item) => item.id === params.orgUnitId);
      if (!unit) return notFound();

      const requestBody = (await request.json()) as Record<string, unknown>;

      const refused = unknownKey(requestBody, ['name']);
      if (refused) return invalid(refused, 'Campo não permitido.');

      const parsed = parseName(requestBody.name);
      if (parsed.response) return parsed.response;

      const { name } = parsed;
      if (hasSiblingNamed({ parentId: unit.parentId, name, exceptId: unit.id })) {
        return conflict();
      }

      const body: OrgUnitResponse = { data: renameOrgUnit(unit.id, name) };
      return HttpResponse.json(body);
    },
  ),
];
