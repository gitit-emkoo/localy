import { create } from 'zustand';

type AuthPhase = 'signed_out' | 'signed_in';

interface SessionState {
  authPhase: AuthPhase;
  setAuthPhase: (phase: AuthPhase) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  authPhase: 'signed_out',
  setAuthPhase: (phase) => set({ authPhase: phase }),
}));
