import { render } from '@testing-library/react';
import { createRef } from 'react';
import { expect, test } from 'vitest';

import { screen } from '@/testing/test-utils';

import { ContentLayout } from '../content-layout';

test('forwards ref and tabIndex to the main element', () => {
  const ref = createRef<HTMLElement>();

  render(
    <ContentLayout ref={ref} tabIndex={-1} title="Título" description="Apoio">
      <p>Conteúdo</p>
    </ContentLayout>,
  );

  const main = screen.getByRole('main');
  expect(ref.current).toBe(main);
  expect(main).toHaveAttribute('tabindex', '-1');
  expect(
    screen.getByRole('heading', { level: 1, name: 'Título' }),
  ).toBeInTheDocument();
});
