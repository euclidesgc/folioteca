// The public route only exists from slice 086 on; until then the link is built
// and copied, but opening it lands on the app's not-found page. That is also
// why the path is not in `config/paths.ts` yet: `paths` describes routes the
// router knows.
const INVITATION_PATH = '/invitations';

// The origin comes from the caller (the page reads it from the browser), never
// from inside: the API does not know where the app is served from, and keeping
// the global out makes this function pure.
export const buildInvitationLink = ({
  origin,
  token,
}: {
  origin: string;
  token: string;
}): string =>
  `${origin.replace(/\/+$/, '')}${INVITATION_PATH}/${encodeURIComponent(token)}`;
