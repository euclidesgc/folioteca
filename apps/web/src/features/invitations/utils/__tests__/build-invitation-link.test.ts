import { expect, test } from 'vitest';

import { paths } from '@/config/paths';

import { buildInvitationLink } from '../build-invitation-link';

test('builds the link from the origin and the token', () => {
  expect(
    buildInvitationLink({
      origin: 'https://app.exemplo.org',
      token: 'abc123',
    }),
  ).toBe('https://app.exemplo.org/invitations/abc123');
});

test('uses the path of the route the router knows', () => {
  expect(
    buildInvitationLink({
      origin: 'https://app.exemplo.org',
      token: 'abc123',
    }),
  ).toBe(`https://app.exemplo.org${paths.invitationAccept.getHref('abc123')}`);
});

test('does not duplicate the slash when the origin ends with one', () => {
  expect(
    buildInvitationLink({
      origin: 'https://app.exemplo.org/',
      token: 'abc123',
    }),
  ).toBe('https://app.exemplo.org/invitations/abc123');
});

test('escapes a token with characters outside the expected alphabet', () => {
  expect(
    buildInvitationLink({
      origin: 'https://app.exemplo.org',
      token: 'a b/c?d#e',
    }),
  ).toBe('https://app.exemplo.org/invitations/a%20b%2Fc%3Fd%23e');
});
