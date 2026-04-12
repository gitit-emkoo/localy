import { create } from 'zustand';

/** 회원가입: 이메일·비밀번호 입력 → OTP 인증 후 updateUser(password)에 사용 */
type SignupDraft = { email: string; password: string };

interface State {
  draft: SignupDraft | null;
  setDraft: (d: SignupDraft | null) => void;
  clearDraft: () => void;
}

export const useSignupDraftStore = create<State>((set) => ({
  draft: null,
  setDraft: (d) => set({ draft: d }),
  clearDraft: () => set({ draft: null }),
}));
