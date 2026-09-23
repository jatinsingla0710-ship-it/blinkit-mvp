import { create } from 'zustand';

interface SessionState {
  guestName: string;
  phone: string;
  setGuest: (name: string, phone: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  guestName: 'Guest',
  phone: '',
  setGuest: (guestName, phone) => set({ guestName, phone }),
}));
