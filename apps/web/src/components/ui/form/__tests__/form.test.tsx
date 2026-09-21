import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { expect, test, vi } from 'vitest';
import { z } from 'zod';

import { Form } from '../form';
import { Input } from '../input';

const schema = z.object({
  nome: z.string().min(1, 'Informe o nome.'),
});

type Values = z.infer<typeof schema>;

type TestFormProps = {
  onSubmit?: (values: Values) => void;
  description?: string;
};

const TestForm = ({
  onSubmit = () => {},
  description,
}: TestFormProps): React.JSX.Element => (
  <Form
    schema={schema}
    options={{ defaultValues: { nome: '' } }}
    onSubmit={(values) => onSubmit(values)}
  >
    {({ register, formState }) => (
      <>
        <Input
          label="Nome"
          description={description}
          error={formState.errors.nome}
          registration={register('nome')}
        />
        <button type="submit">Enviar</button>
      </>
    )}
  </Form>
);

test('links the label to the input', () => {
  render(<TestForm />);

  expect(screen.getByLabelText('Nome')).toHaveAttribute('name', 'nome');
});

test('shows the field error and sets aria-invalid and aria-describedby', async () => {
  const user = userEvent.setup();
  render(<TestForm />);

  await user.click(screen.getByRole('button', { name: 'Enviar' }));

  const error = await screen.findByText('Informe o nome.');
  const input = screen.getByLabelText('Nome');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input.getAttribute('aria-describedby')).toBe(error.id);
});

test('renders the description and links it through aria-describedby', () => {
  render(<TestForm description="Mínimo de 12 caracteres." />);

  const description = screen.getByText('Mínimo de 12 caracteres.');
  expect(screen.getByLabelText('Nome').getAttribute('aria-describedby')).toBe(
    description.id,
  );
});

test('links both the description and the error when both exist', async () => {
  const user = userEvent.setup();
  render(<TestForm description="Mínimo de 12 caracteres." />);

  await user.click(screen.getByRole('button', { name: 'Enviar' }));

  const error = await screen.findByText('Informe o nome.');
  const description = screen.getByText('Mínimo de 12 caracteres.');
  expect(
    screen.getByLabelText('Nome').getAttribute('aria-describedby')?.split(' '),
  ).toEqual([description.id, error.id]);
});

test('calls onSubmit with the parsed values', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<TestForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText('Nome'), 'Ana');
  await user.click(screen.getByRole('button', { name: 'Enviar' }));

  await vi.waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Ana' }),
  );
});

test('does not call onSubmit when the schema fails', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<TestForm onSubmit={onSubmit} />);

  await user.click(screen.getByRole('button', { name: 'Enviar' }));

  await screen.findByText('Informe o nome.');
  expect(onSubmit).not.toHaveBeenCalled();
});
