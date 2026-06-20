import { API_BASE } from "./constants";

// ——— Token store for auth ———
let _accessToken: string | null = localStorage.getItem("stellar_access_token");
let _refreshToken: string | null = localStorage.getItem("stellar_refresh_token");

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  localStorage.setItem("stellar_access_token", access);
  localStorage.setItem("stellar_refresh_token", refresh);
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  localStorage.removeItem("stellar_access_token");
  localStorage.removeItem("stellar_refresh_token");
}

export function getAccessToken() {
  return _accessToken;
}

// ——— Base request with auto-refresh ———
async function request<T>(path: string, options?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (options?.auth !== false && _accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && _refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${_accessToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: _refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

// ——— Auth ———
export const authApi = {
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    request<any>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
      auth: false,
    } as any),

  login: (data: { email: string; password: string }) =>
    request<any>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
      auth: false,
    } as any),

  me: () => request<any>("/api/v1/auth/me"),

  updateProfile: (data: { firstName?: string; lastName?: string; preferredLanguage?: string; preferredNetwork?: string }) =>
    request<any>("/api/v1/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<any>("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<any>("/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: _refreshToken }),
    }).finally(() => clearTokens()),
};

// ——— User Wallets (server-side) ———
export const userWalletApi = {
  list: () => request<any[]>("/api/v1/wallets"),

  add: (data: { name: string; publicKey: string; encryptedSecret?: string; network?: string }) =>
    request<any>("/api/v1/wallets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  activate: (id: number) => request<any>(`/api/v1/wallets/${id}/activate`, { method: "PATCH", body: JSON.stringify({}) }),
  rename: (id: number, name: string) => request<any>(`/api/v1/wallets/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  remove: (id: number) => request<any>(`/api/v1/wallets/${id}`, { method: "DELETE" }),
};

// ——— Tokens ———
export const tokenApi = {
  featured: () => request<any[]>("/api/v1/tokens/featured"),
  search: (query: string, sortBy = "rating", limit = 50) =>
    request<any[]>(`/api/v1/tokens?query=${encodeURIComponent(query)}&sortBy=${sortBy}&limit=${limit}`),
  detail: (code: string, issuer: string) =>
    request<any>(`/api/v1/tokens/${encodeURIComponent(code)}/${encodeURIComponent(issuer)}`),
  userTokens: (publicKey: string) =>
    request<any[]>(`/api/v1/tokens/user/${publicKey}`),
  toggleFavorite: (publicKey: string, code: string, issuer: string) =>
    request<any>("/api/v1/tokens/favorite", {
      method: "POST",
      body: JSON.stringify({ publicKey, assetCode: code, assetIssuer: issuer }),
    }),
};

// ——— Swap ———
export const swapApi = {
  quote: (params: { fromCode: string; fromIssuer: string; toCode: string; toIssuer: string; amount: string }) =>
    request<any[]>(`/api/v1/swap/quote?fromCode=${params.fromCode}&fromIssuer=${params.fromIssuer}&toCode=${params.toCode}&toIssuer=${params.toIssuer}&amount=${params.amount}`),
  build: (params: any) =>
    request<{ xdr: string; networkPassphrase: string }>("/api/v1/swap/build", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};

// ——— Wallet (legacy Horizon helpers) ———
export const walletApi = {
  account: (publicKey: string) => request<any>(`/api/v1/wallet/${publicKey}`),
  fund: (publicKey: string) =>
    request<any>("/api/v1/wallet/fund", { method: "POST", body: JSON.stringify({ publicKey }) }),
};

// ——— Transactions ———
export const txApi = {
  submit: (signedXdr: string) =>
    request<any>("/api/v1/transactions/submit", {
      method: "POST",
      body: JSON.stringify({ signedXdr }),
    }),
  history: (publicKey: string, limit = 20, cursor?: string) =>
    request<any[]>(
      `/api/v1/transactions/${publicKey}?limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`
    ),
};

// ——— Signing Mode (Delegated) ———
export const signingApi = {
  getMode: () =>
    request<{ signingMode: string }>("/api/v1/user/signing-mode").then(
      (data) => data.signingMode as "self" | "delegated"
    ),

  setMode: (mode: "self" | "delegated") =>
    request<any>("/api/v1/user/signing-mode", {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),

  sign: (xdr: string, networkPassphrase: string) =>
    request<{ signedXdr: string; networkPassphrase: string }>("/api/v1/transactions/sign", {
      method: "POST",
      body: JSON.stringify({ xdr, networkPassphrase }),
    }),

  signAndSubmit: (xdr: string, networkPassphrase: string) =>
    request<any>("/api/v1/transactions/sign-and-submit", {
      method: "POST",
      body: JSON.stringify({ xdr, networkPassphrase }),
    }),
};

// ——— API Keys ———
export const apiKeyApi = {
  create: (name: string) =>
    request<{ id: number; name: string; key: string; createdAt: string; message: string }>(
      "/api/v1/api-keys",
      {
        method: "POST",
        body: JSON.stringify({ name }),
      }
    ),

  list: () =>
    request<
      {
        id: number;
        name: string;
        keyPreview: string;
        isActive: boolean;
        lastUsedAt: string | null;
        createdAt: string;
      }[]
    >("/api/v1/api-keys"),

  revoke: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/v1/api-keys/${id}`, {
      method: "DELETE",
    }),
};

// ——— Keypair ———
export const keypairApi = {
  generate: () => request<{ publicKey: string; secretKey: string }>("/api/v1/keypair/generate"),
  fromSecret: (secret: string) =>
    request<{ publicKey: string }>("/api/v1/keypair/from-secret", {
      method: "POST",
      body: JSON.stringify({ secret }),
    }),
  validateMnemonic: (mnemonic: string) =>
    request<{ valid: boolean }>("/api/v1/keypair/validate-mnemonic", {
      method: "POST",
      body: JSON.stringify({ mnemonic }),
    }),
  fromMnemonic: (mnemonic: string, accountIndex = 0) =>
    request<{ publicKey: string; secretKey: string; accountIndex: number }>(
      "/api/v1/keypair/from-mnemonic",
      {
        method: "POST",
        body: JSON.stringify({ mnemonic, accountIndex }),
      }
    ),
};
