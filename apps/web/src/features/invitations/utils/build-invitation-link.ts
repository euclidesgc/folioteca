import { paths } from '@/config/paths';

// The origin comes from the caller (the page reads it from the browser), never
// from inside: the API does not know where the app is served from, and keeping
// the global out makes this function pure. The path is the one the router
// knows, so link and route can never drift apart.
export const buildInvitationLink = ({
  origin,
  token,
}: {
  origin: string;
  token: string;
}): string =>
  `${origin.replace(/\/+$/, '')}${paths.invitationAccept.getHref(token)}`;
