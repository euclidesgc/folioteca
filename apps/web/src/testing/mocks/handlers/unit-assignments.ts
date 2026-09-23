import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';

import {
  addAssignment,
  allPeople,
  getDb,
  type MockPerson,
  removeAssignment,
} from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type AssignedPeopleResponse =
  components['schemas']['AssignedPeopleResponse'];
type AssignedPersonResponse = components['schemas']['AssignedPersonResponse'];

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const forbidden = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Apenas a administração pode fazer isso.' },
    { status: 403 },
  );

// The same opaque 404 of every other route about a unit: it does not tell an
// unknown id from one of another organization.
const unitNotFound = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Unidade não encontrada.' }, { status: 404 });

// A separate message on purpose: "the unit is gone" sends the screen back to
// the structure, "the person is gone" asks for a new search.
const personNotFound = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Pessoa não encontrada.' }, { status: 404 });

const alreadyAssigned = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Esta pessoa já está lotada nesta unidade.' },
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

// Same ordering the API does in memory: pt-BR collator ignoring accents and
// case, with a deterministic tie-break by id.
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

const byName = (a: MockPerson, b: MockPerson): number =>
  collator.compare(a.name, b.name) || a.id.localeCompare(b.id);

export const unitAssignmentsHandlers = [
  http.get(
    `${env.API_URL}/org-units/:orgUnitId/people`,
    async ({ params, cookies }) => {
      await networkDelay();
      const forced = await devOverride('unit-assignments');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { installation, orgUnits, assignments } = getDb();
      if (!installation) return unauthenticated();
      if (!installation.person.isAdmin) return forbidden();

      const unit = orgUnits.find((item) => item.id === params.orgUnitId);
      if (!unit) return unitNotFound();

      const people = allPeople();
      const assigned = assignments
        .filter((item) => item.orgUnitId === unit.id)
        .flatMap((item) => people.filter((person) => person.id === item.personId))
        .sort(byName);

      const body: AssignedPeopleResponse = {
        data: assigned.map(({ id, name, email }) => ({ id, name, email })),
        orgUnit: { id: unit.id, name: unit.name },
      };
      return HttpResponse.json(body);
    },
  ),

  http.post(
    `${env.API_URL}/org-units/:orgUnitId/people`,
    async ({ params, request, cookies }) => {
      await networkDelay();
      const forced = await devOverride('unit-assignments');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { installation, orgUnits } = getDb();
      if (!installation) return unauthenticated();
      if (!installation.person.isAdmin) return forbidden();

      // The unit is resolved before the body, as the API does: whoever cannot
      // see the unit gets a 404, never a 400 telling the unit exists.
      const unit = orgUnits.find((item) => item.id === params.orgUnitId);
      if (!unit) return unitNotFound();

      const requestBody = (await request.json()) as Record<string, unknown>;

      const refused = Object.keys(requestBody).find((key) => key !== 'personId');
      if (refused) return invalid(refused, 'Campo não permitido.');

      const { personId } = requestBody;
      if (typeof personId !== 'string' || personId.length === 0) {
        return invalid('personId', 'Informe a pessoa.');
      }

      const person = allPeople().find((item) => item.id === personId);
      if (!person) return personNotFound();

      if (addAssignment(unit.id, person.id) === 'duplicate') {
        return alreadyAssigned();
      }

      const body: AssignedPersonResponse = {
        data: { id: person.id, name: person.name, email: person.email },
      };
      return HttpResponse.json(body, { status: 201 });
    },
  ),

  http.delete(
    `${env.API_URL}/org-units/:orgUnitId/people/:personId`,
    async ({ params, cookies }) => {
      await networkDelay();
      const forced = await devOverride('unit-assignments');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { installation, orgUnits } = getDb();
      if (!installation) return unauthenticated();
      if (!installation.person.isAdmin) return forbidden();

      // The unit is resolved before anything about the person, as the API
      // does: whoever cannot see the unit never learns about its people.
      const unit = orgUnits.find((item) => item.id === params.orgUnitId);
      if (!unit) return unitNotFound();

      // A single 404 for "there is no such person", "the person is of another
      // organization" and "the person was not assigned here": the fake API
      // tells them apart as little as the real one does.
      if (!removeAssignment(unit.id, String(params.personId))) {
        return personNotFound();
      }

      return new HttpResponse(null, { status: 204 });
    },
  ),
];
