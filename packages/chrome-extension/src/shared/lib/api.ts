const API_BASE =
  import.meta.env.VITE_API_URL || "https://ammawallet.com";

// ─── Token storage ─────────────────────────────────────────
const ACCESS_KEY = "stellar_ext_access_token";
const REFRESH_KEY = "stellar_ext_refresh_token";

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

// ─── Core request wrapper ──────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getAccessToken()}`;
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
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ─── Auth ──────────────────────────────────────────────────
export const authApi = {
  register: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) =>
    request<{ user: any; accessToken: string; refreshToken: string }>(
      "/api/v1/auth/register",
      { method: "POST", body: JSON.stringify(data) }
    ),
  login: (email: string, password: string) =>
    request<{ user: any; accessToken: string; refreshToken: string }>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  me: () => request<{ user: any }>("/api/v1/auth/me"),
  updateProfile: (data: Record<string, any>) =>
    request<{ user: any }>("/api/v1/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  logout: () => {
    const refreshToken = getRefreshToken();
    return request<{ message: string }>("/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },
};

// ─── Tokens ────────────────────────────────────────────────
export const tokenApi = {
  featured: () => request<any[]>("/api/v1/tokens/featured"),
  search: (query: string, sortBy = "rating", limit = 50) =>
    request<any[]>(
      `/api/v1/tokens?query=${encodeURIComponent(query)}&sortBy=${sortBy}&limit=${limit}`
    ),
  detail: (code: string, issuer: string) =>
    request<any>(
      `/api/v1/tokens/${encodeURIComponent(code)}/${encodeURIComponent(issuer)}`
    ),
  userTokens: (publicKey: string) =>
    request<any[]>(`/api/v1/tokens/user/${publicKey}`),
  toggleFavorite: (publicKey: string, code: string, issuer: string) =>
    request<any>("/api/v1/tokens/favorite", {
      method: "POST",
      body: JSON.stringify({
        publicKey,
        assetCode: code,
        assetIssuer: issuer,
      }),
    }),
};

// ─── Swap ──────────────────────────────────────────────────
export const swapApi = {
  quote: (params: {
    fromCode: string;
    fromIssuer: string;
    toCode: string;
    toIssuer: string;
    amount: string;
  }) =>
    request<any[]>(
      `/api/v1/swap/quote?fromCode=${params.fromCode}&fromIssuer=${params.fromIssuer}&toCode=${params.toCode}&toIssuer=${params.toIssuer}&amount=${params.amount}`
    ),
  build: (params: any) =>
    request<{ xdr: string; networkPassphrase: string }>("/api/v1/swap/build", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};

// ─── Wallet ────────────────────────────────────────────────
export const walletApi = {
  account: (publicKey: string) =>
    request<any>(`/api/v1/wallet/${publicKey}`),
  fund: (publicKey: string) =>
    request<any>("/api/v1/wallet/fund", {
      method: "POST",
      body: JSON.stringify({ publicKey }),
    }),
};

// ─── Transactions ──────────────────────────────────────────
export const txApi = {
  submit: (xdr: string, network: string) =>
    request<any>("/api/v1/transactions/submit", {
      method: "POST",
      body: JSON.stringify({ xdr, networkPassphrase: network }),
    }),
  history: (publicKey: string, limit = 20, cursor?: string) =>
    request<any[]>(
      `/api/v1/transactions/${publicKey}?limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`
    ),
};

// ─── User Wallets ──────────────────────────────────────────
export const userWalletApi = {
  list: () => request<any[]>("/api/v1/wallets"),

  add: (data: {
    name: string;
    publicKey: string;
    encryptedSecret?: string;
    network?: string;
  }) =>
    request<any>("/api/v1/wallets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  activate: (id: number) =>
    request<any>(`/api/v1/wallets/${id}/activate`, {
      method: "PATCH",
      body: JSON.stringify({}),
    }),

  rename: (id: number, name: string) =>
    request<any>(`/api/v1/wallets/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  remove: (id: number) => request<any>(`/api/v1/wallets/${id}`, { method: "DELETE" }),
};

// ─── Signing ───────────────────────────────────────────────
export const signingApi = {
  getMode: () =>
    request<{ signingMode: "self" | "delegated" }>("/api/v1/user/signing-mode").then(
      (data) => data.signingMode
    ),

  setMode: (mode: "self" | "delegated") =>
    request<any>("/api/v1/user/signing-mode", {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),

  sign: (xdr: string, networkPassphrase: string) =>
    request<{ signedXdr: string }>("/api/v1/transactions/sign", {
      method: "POST",
      body: JSON.stringify({ xdr, networkPassphrase }),
    }),

  signAndSubmit: (xdr: string, networkPassphrase: string) =>
    request<any>("/api/v1/transactions/sign-and-submit", {
      method: "POST",
      body: JSON.stringify({ xdr, networkPassphrase }),
    }),
};

// ─── Keypair ───────────────────────────────────────────────
export const keypairApi = {
  generate: () => request<{ publicKey: string; secretKey: string }>("/api/v1/keypair/generate"),
  fromSecret: (secret: string) =>
    request<{ publicKey: string }>("/api/v1/keypair/from-secret", {
      method: "POST",
      body: JSON.stringify({ secretKey: secret }),
    }),
  validateMnemonic: (mnemonic: string) =>
    request<{ valid: boolean }>("/api/v1/keypair/validate-mnemonic", {
      method: "POST",
      body: JSON.stringify({ mnemonic }),
    }),
  fromMnemonic: (mnemonic: string, accountIndex = 0) =>
    request<{ publicKey: string; secretKey: string }>("/api/v1/keypair/from-mnemonic", {
      method: "POST",
      body: JSON.stringify({ mnemonic, accountIndex }),
    }),
};
