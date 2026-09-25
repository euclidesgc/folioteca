import { create } from 'zustand';

import { useUser } from '@/lib/auth';
import type { DocumentPageWidth } from '@/types/api';

// The width chosen in this session. Keyed by the person, so a choice never
// leaks to someone else who signs in on the same tab after a logout. Kept in
// memory only: after a reload the server value is the one that counts.
type SessionChoice = { personId: string; width: DocumentPageWidth };

type PageWidthStore = {
  sessionChoice: SessionChoice | null;
  setSessionChoice: (sessionChoice: SessionChoice | null) => void;
};

export const usePageWidthStore = create<PageWidthStore>((set) => ({
  sessionChoice: null,
  setSessionChoice: (sessionChoice) => set({ sessionChoice }),
}));

// The width the sheet is shown in: the choice of this session wins over the
// server value, so a failed save or a later refetch of GET /auth/me never
// takes the sheet back to the old width in the middle of the session.
export const usePageWidth = (): DocumentPageWidth => {
  const user = useUser();
  const sessionChoice = usePageWidthStore((state) => state.sessionChoice);
  const person = user.data?.person;

  if (person && sessionChoice?.personId === person.id) {
    return sessionChoice.width;
  }

  // `medium` is the default of the column, for the instant before the
  // session is known.
  return person?.documentPageWidth ?? 'medium';
};
