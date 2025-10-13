// src/lib/authStore.ts
import { create } from "zustand";

interface AuthState {
  loggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  loggedIn: false,
  setLoggedIn: (v) => set({ loggedIn: v }),
}));
