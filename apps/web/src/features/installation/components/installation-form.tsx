import type React from 'react';

import { Button } from '@/components/ui/button/button';
import { Form } from '@/components/ui/form/form';
import { Input } from '@/components/ui/form/input';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import {
  createInstallationInputSchema,
  useCreateInstallation,
} from '@/features/installation/api/create-installation';

type InstallationFormProps = {
  onSuccess: () => void;
};

export function InstallationForm({
  onSuccess,
}: InstallationFormProps): React.JSX.Element {
  const addNotification = useNotifications(
    (state) => state.addNotification,
  );
  const createInstallationMutation = useCreateInstallation();

  return (
    <Form
      schema={createInstallationInputSchema}
      options={{
        defaultValues: {
          code: '',
          organizationName: '',
          name: '',
          email: '',
          password: '',
        },
      }}
      className="mt-6"
      onSubmit={(values) => {
        // A second Enter can arrive before the button re-renders as disabled.
        if (createInstallationMutation.isPending) return;

        createInstallationMutation.mutate(
          { data: values },
          {
            onSuccess: () => {
              addNotification({
                type: 'success',
                title: 'Instalação concluída',
              });
              onSuccess();
            },
          },
        );
      }}
    >
      {({ register, formState }) => (
        <>
          <Input
            label="Código de instalação"
            type="text"
            autoComplete="off"
            error={formState.errors.code}
            registration={register('code')}
          />

          <Input
            label="Nome da organização"
            type="text"
            autoComplete="organization"
            error={formState.errors.organizationName}
            registration={register('organizationName')}
          />

          <Input
            label="Seu nome"
            type="text"
            autoComplete="name"
            error={formState.errors.name}
            registration={register('name')}
          />

          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            error={formState.errors.email}
            registration={register('email')}
          />

          <Input
            label="Senha"
            type="password"
            autoComplete="new-password"
            description="Mínimo de 12 caracteres."
            error={formState.errors.password}
            registration={register('password')}
          />

          {/* The same alert for every server failure: nothing here tells a
              wrong code apart from an already installed instance. */}
          {createInstallationMutation.isError ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              Instalação não concluída. Confira os dados informados e tente de
              novo.
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            isLoading={createInstallationMutation.isPending}
          >
            {createInstallationMutation.isPending ? 'Instalando…' : 'Instalar'}
          </Button>
        </>
      )}
    </Form>
  );
}
