import { expect, it } from 'vitest';

import { getSaveStatus } from '../get-save-status';

// Exactly the six rules of the table, one case each; the rows that must not
// change the answer are asserted side by side, without a loop.

it('returns unreachable when disconnected before the first sync', () => {
  expect(
    getSaveStatus({
      connection: 'disconnected',
      hasSynced: false,
      unsyncedChanges: 0,
    }),
  ).toBe('unreachable');
  expect(
    getSaveStatus({
      connection: 'disconnected',
      hasSynced: false,
      unsyncedChanges: 3,
    }),
  ).toBe('unreachable');
});

it('returns offline when disconnected after the first sync, whatever the unsynced changes', () => {
  expect(
    getSaveStatus({
      connection: 'disconnected',
      hasSynced: true,
      unsyncedChanges: 0,
    }),
  ).toBe('offline');
  expect(
    getSaveStatus({
      connection: 'disconnected',
      hasSynced: true,
      unsyncedChanges: 3,
    }),
  ).toBe('offline');
});

it('returns saving when connected with unsynced changes', () => {
  expect(
    getSaveStatus({
      connection: 'connected',
      hasSynced: true,
      unsyncedChanges: 1,
    }),
  ).toBe('saving');
  expect(
    getSaveStatus({
      connection: 'connected',
      hasSynced: false,
      unsyncedChanges: 5,
    }),
  ).toBe('saving');
});

it('returns saved when connected, synced and with nothing pending', () => {
  expect(
    getSaveStatus({
      connection: 'connected',
      hasSynced: true,
      unsyncedChanges: 0,
    }),
  ).toBe('saved');
});

it('returns connecting when connected but not yet synced', () => {
  expect(
    getSaveStatus({
      connection: 'connected',
      hasSynced: false,
      unsyncedChanges: 0,
    }),
  ).toBe('connecting');
});

it('returns connecting while connecting', () => {
  expect(
    getSaveStatus({
      connection: 'connecting',
      hasSynced: false,
      unsyncedChanges: 0,
    }),
  ).toBe('connecting');
  expect(
    getSaveStatus({
      connection: 'connecting',
      hasSynced: true,
      unsyncedChanges: 0,
    }),
  ).toBe('connecting');
  expect(
    getSaveStatus({
      connection: 'connecting',
      hasSynced: true,
      unsyncedChanges: 2,
    }),
  ).toBe('connecting');
});
