import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import type {
  CreateInstallationBody,
  CurrentUserResponse,
  InstallationStatusResponse,
} from '@/types/api';

import { addUnitSpace, getDb, rootOrgUnit, seedDb } from '../db';
import {
  devOverride,
  MOCK_INSTALL_CODE,
  networkDelay,
  SESSION_COOKIE_NAME,
} from '../utils';

type FieldError = { field: string; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lightweight mirror of the real installation schema: it validates enough to
// exercise every screen state, not the API's own rules.
const validate = (body: Partial<CreateInstallationBody>): FieldError[] => {
  const errors: FieldError[] = [];

  if (!body.organizationName?.trim()) {
    errors.push({
      field: 'organizationName',
      message: 'Informe o nome da organização.',
    });
  } else if (body.organizationName.trim().length > 120) {
    errors.push({
      field: 'organizationName',
      message: 'O nome da organização pode ter no máximo 120 caracteres.',
    });
  }

  if (!body.name?.trim()) {
    errors.push({ field: 'name', message: 'Informe o seu nome.' });
  } else if (body.name.trim().length > 120) {
    errors.push({
      field: 'name',
      message: 'O nome pode ter no máximo 120 caracteres.',
    });
  }

  if (!body.email?.trim()) {
    errors.push({ field: 'email', message: 'Informe o e-mail.' });
  } else if (!EMAIL_PATTERN.test(body.email.trim())) {
    errors.push({ field: 'email', message: 'Informe um e-mail válido.' });
  }

  if (!body.password || body.password.length < 12) {
    errors.push({
      field: 'password',
      message: 'A senha precisa ter pelo menos 12 caracteres.',
    });
  } else if (body.password.length > 128) {
    errors.push({
      field: 'password',
      message: 'A senha pode ter no máximo 128 caracteres.',
    });
  }

  return errors;
};

export const installationHandlers = [
  http.get(`${env.API_URL}/installation`, async () => {
    await networkDelay();
    const forced = await devOverride('installation');
    if (forced) return forced;

    const body: InstallationStatusResponse = {
      data: { installed: getDb().installation !== null },
    };
    return HttpResponse.json(body);
  }),

  http.post(`${env.API_URL}/installation`, async ({ request }) => {
    await networkDelay();
    const forced = await devOverride('installation');
    if (forced) return forced;

    if (getDb().installation !== null) {
      return HttpResponse.json(
        { message: 'Esta instância já foi instalada.' },
        { status: 409 },
      );
    }

    const requestBody = (await request.json()) as Partial<
      CreateInstallationBody & { code: string }
    >;

    if (requestBody.code !== MOCK_INSTALL_CODE) {
      return HttpResponse.json(
        {
          message:
            'Não foi possível concluir a instalação. Confira os dados informados.',
        },
        { status: 403 },
      );
    }

    const errors = validate(requestBody);
    if (errors.length > 0) {
      return HttpResponse.json(
        { message: 'Dados inválidos.', errors },
        { status: 400 },
      );
    }

    const organization = {
      id: 'org-1',
      name: requestBody.organizationName!.trim(),
    };
    const person = {
      id: 'person-1',
      name: requestBody.name!.trim(),
      email: requestBody.email!.trim().toLowerCase(),
      isAdmin: true,
    };

    // The password is kept so POST /auth/login can check it later; it never
    // goes back in a response. The real API also creates the root unit of the
    // organization tree here, together with its `UNIT` space.
    const root = rootOrgUnit(organization.name);
    seedDb({
      // `validate` above already rejected a missing password.
      installation: { organization, person, password: requestBody.password ?? '' },
      orgUnits: [root],
    });
    addUnitSpace(root.id);

    const responseBody: CurrentUserResponse = {
      data: { person: { ...person, documentPageWidth: 'medium' }, organization },
    };

    // Session is written the same way `seedInstalled` does, to `document.cookie`
    // directly: MSW's own `Set-Cookie` handling persists across
    // `server.resetHandlers()` (it lives in an internal cookie store, not in
    // `document.cookie`), which leaked a signed-in session from one test into
    // the next.
    document.cookie = `${SESSION_COOKIE_NAME}=mock-session-token; path=/`;

    return HttpResponse.json(responseBody, { status: 201 });
  }),
];
