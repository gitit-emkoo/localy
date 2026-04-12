import { create } from 'zustand';

import type { Session } from '@supabase/supabase-js';

export type AuthPhase = 'booting' | 'signed_out' | 'signed_in';
export type ProfilePhase = 'unknown' | 'profile_incomplete' | 'profile_completed';

interface AuthState {
  authPhase: AuthPhase;
  profilePhase: ProfilePhase;
  session: Session | null;
  setSession: (session: Session | null) => void;
  setAuthPhase: (phase: AuthPhase) => void;
  setProfilePhase: (phase: ProfilePhase) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authPhase: 'booting',
  profilePhase: 'unknown',
  session: null,
  setSession: (session) => set({ session }),
  setAuthPhase: (authPhase) => set({ authPhase }),
  setProfilePhase: (profilePhase) => set({ profilePhase }),
}));
