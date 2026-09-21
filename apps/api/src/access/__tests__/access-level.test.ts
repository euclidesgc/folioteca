import { canEdit } from '../access-level';

test('canEdit returns true for owner', () => {
  expect(canEdit('owner')).toBe(true);
});

test('canEdit returns true for edit', () => {
  expect(canEdit('edit')).toBe(true);
});

test('canEdit returns false for view', () => {
  expect(canEdit('view')).toBe(false);
});

test('canEdit returns false for none', () => {
  expect(canEdit('none')).toBe(false);
});
