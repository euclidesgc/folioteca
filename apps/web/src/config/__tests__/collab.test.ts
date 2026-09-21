import { expect, test } from 'vitest';

import { getCollabUrl } from '../collab';

test('returns ws://host/collab on an http page', () => {
  expect(
    getCollabUrl({ protocol: 'http:', host: 'folioteca.exemplo.com.br' }),
  ).toBe('ws://folioteca.exemplo.com.br/collab');
});

test('returns wss://host/collab on an https page', () => {
  expect(
    getCollabUrl({ protocol: 'https:', host: 'folioteca.exemplo.com.br' }),
  ).toBe('wss://folioteca.exemplo.com.br/collab');
});

test('keeps the port of the page host', () => {
  expect(getCollabUrl({ protocol: 'http:', host: 'localhost:5173' })).toBe(
    'ws://localhost:5173/collab',
  );

  // Without an argument it reads the address bar, port included.
  expect(getCollabUrl()).toBe(`ws://${window.location.host}/collab`);
  expect(window.location.host).toContain(':');
});
