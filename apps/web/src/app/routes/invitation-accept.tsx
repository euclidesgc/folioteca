import type React from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { paths } from '@/config/paths';
import { useInvitation } from '@/features/invitations/api/get-invitation';
import { AcceptInvitationForm } from '@/features/invitations/components/accept-invitation-form';

// The frame of the recipe "Tela pública centrada": the three states — loading,
// error and content — live in this very same place.
function PublicScreen({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <main id="main-content" className="mx-auto max-w-md p-8">
      {children}
    </main>
  );
}

// One text for the four cases: the screen does not know which one it was,
// because the server does not tell — and it never echoes the server's message.
function InvitationUnavailable(): React.JSX.Element {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 p-4"
    >
      <h1 className="text-2xl font-bold text-red-800">Convite indisponível</h1>
      <p className="mt-2 text-red-800">
        Este link de convite não é válido. Ele pode ter expirado ou já ter sido
        usado. Se você ainda precisa de acesso, peça um convite novo.
      </p>
      <Link
        to={paths.login.getHref()}
        className="mt-3 inline-block font-medium text-blue-600 underline-offset-4 hover:underline"
      >
        Ir para a tela de entrar
      </Link>
    </div>
  );
}

// Nothing here reads who is signed in, and nothing here signs anybody out:
// opening an invitation link with a session in progress shows this same screen
// and leaves that session exactly as it was.
export function Component(): React.JSX.Element {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const invitation = useInvitation({ token });
  // The invitation died between opening the link and sending the form.
  const [hasExpired, setHasExpired] = useState(false);

  if (invitation.isPending) {
    return (
      <PublicScreen>
        <p role="status" className="text-gray-600">
          Carregando o convite…
        </p>
      </PublicScreen>
    );
  }

  // Any failure, not only a 404: the screen has nothing different to say, and
  // telling them apart would hand over what the server refused to give.
  if (invitation.isError || hasExpired) {
    return (
      <PublicScreen>
        <InvitationUnavailable />
      </PublicScreen>
    );
  }

  return (
    <PublicScreen>
      <AcceptInvitationForm
        token={token}
        email={invitation.data.data.email}
        organizationName={invitation.data.data.organizationName}
        onSuccess={() => {
          // `replace` takes the invitation link out of the history: going back
          // never reloads a token that has already been used.
          void navigate(paths.home.getHref(), { replace: true });
        }}
        onExpired={() => {
          setHasExpired(true);
        }}
      />
    </PublicScreen>
  );
}
