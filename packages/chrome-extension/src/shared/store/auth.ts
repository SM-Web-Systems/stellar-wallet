import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, signingApi, setTokens, clearTokens, getAccessToken } from "../lib/api";
import { useWalletStore } from "./wallet";

interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  preferredLanguage: string;
  preferredNetwork: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  signingMode: "self" | "delegated";

  register: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    preferredLanguage?: string;
    preferredNetwork?: string;
  }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

async function fetchSigningMode(): Promise<"self" | "delegated"> {
  try {
    return await signingApi.getMode();
  } catch {
    return "self";
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      signingMode: "self",

      register: async (data) => {
        const res = await authApi.register(data);
        setTokens(res.accessToken, res.refreshToken);
        set({ user: res.user, isAuthenticated: true });
      },

      login: async (email, password) => {
        const res = await authApi.login(email, password);
        setTokens(res.accessToken, res.refreshToken);
        const signingMode = await fetchSigningMode();
        set({ user: res.user, isAuthenticated: true, signingMode });
        await useWalletStore.getState().syncFromServer();
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {}
        clearTokens();
        useWalletStore.getState().logout();
        set({ user: null, isAuthenticated: false, signingMode: "self" });
      },

      loadProfile: async () => {
        const token = getAccessToken();
        if (!token) {
          set({ user: null, isAuthenticated: false, signingMode: "self" });
          return;
        }
        try {
          const res = await authApi.me();
          const signingMode = await fetchSigningMode();
          set({ user: res.user, isAuthenticated: true, signingMode });
          await useWalletStore.getState().syncFromServer();
        } catch {
          clearTokens();
          set({ user: null, isAuthenticated: false, signingMode: "self" });
        }
      },

      updateProfile: async (data) => {
        const res = await authApi.updateProfile(data);
        set({ user: res.user });
      },

      changePassword: async (currentPassword, newPassword) => {
        await authApi.changePassword(currentPassword, newPassword);
      },
    }),
    {
      name: "stellar-ext-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        signingMode: state.signingMode,
      }),
    }
  )
);
