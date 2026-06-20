import { useAuthStore } from "../store/auth";

const API_BASE = "https://ammawallet.com";

async function request(path: string, options: RequestInit = {}) {
  const { accessToken, refreshSession } = useAuthStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${useAuthStore.getState().accessToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function horizonUrl(publicKey?: string) {
  const network = useAuthStore.getState().user?.preferredNetwork || "testnet";
  const base =
    network === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";
  return publicKey ? `${base}/accounts/${publicKey}` : base;
}

export const tokenApi = {
  featured: () => request("/api/v1/tokens/featured"),
  search: (query: string) => request(`/api/v1/tokens?query=${encodeURIComponent(query)}`),
  userTokens: (pubKey: string) => request(`/api/v1/tokens/user/${pubKey}`),
  detail: (code: string, issuer: string) => request(`/api/v1/tokens/${code}/${issuer}`),
  toggleFavorite: (publicKey: string, tokenId: number) =>
    request("/api/v1/tokens/favorite", {
      method: "POST",
      body: JSON.stringify({ publicKey, tokenId }),
    }),
};

export const swapApi = {
  quote: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/v1/swap/quote?${qs}`);
  },
  build: (body: any) =>
    request("/api/v1/swap/build", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const walletApi = {
  accountInfo: (pubKey: string) => request(`/api/v1/wallet/${pubKey}`),
  fund: (publicKey: string) =>
    request("/api/v1/wallet/fund", {
      method: "POST",
      body: JSON.stringify({ publicKey }),
    }),
  // Server-side wallet management
  list: () => request("/api/v1/wallets"),
  add: (body: { name: string; publicKey: string; encryptedSecret?: string; network?: string }) =>
    request("/api/v1/wallets", { method: "POST", body: JSON.stringify(body) }),
  activate: (id: number) =>
    request(`/api/v1/wallets/${id}/activate`, { method: "PATCH" }),
  rename: (id: number, name: string) =>
    request(`/api/v1/wallets/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  remove: (id: number) =>
    request(`/api/v1/wallets/${id}`, { method: "DELETE" }),
};

export const txApi = {
  history: (pubKey: string, limit = 20, cursor?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return request(`/api/v1/transactions/${pubKey}?${params}`);
  },
  submit: (signedXdr: string) =>
    request("/api/v1/transactions/submit", {
      method: "POST",
      body: JSON.stringify({ signedXdr }),
    }),
};

export const keypairApi = {
  generate: () => request("/api/v1/keypair/generate"),
  fromSecret: (secret: string) =>
    request("/api/v1/keypair/from-secret", {
      method: "POST",
      body: JSON.stringify({ secret }),
    }),
};

export function buildPaymentTx(params: {
  source: string;
  destination: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string;
  memo?: string;
  network?: string;
}) {
  // This is built client-side using Stellar SDK
  // Kept as a placeholder — the actual implementation is in wallet store or send page
  return params;
}

export const trustlineApi = {
  list: (publicKey: string) =>
    fetch(`${API_BASE}/api/v1/trustlines/${publicKey}`).then(r => r.json()),

  check: (publicKey: string, code: string, issuer: string) =>
    fetch(`${API_BASE}/api/v1/trustlines/check/${publicKey}/${code}/${issuer}`).then(r => r.json()),

  buildAdd: (publicKey: string, assetCode: string, assetIssuer: string) =>
    fetch(`${API_BASE}/api/v1/trustlines/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, assetCode, assetIssuer }),
    }).then(r => r.json()),

  buildRemove: (publicKey: string, assetCode: string, assetIssuer: string) =>
    fetch(`${API_BASE}/api/v1/trustlines/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, assetCode, assetIssuer }),
    }).then(r => r.json()),
};

export const signingApi = {
  getMode: () =>
    request("/api/v1/user/signing-mode").then((data) => data.signingMode as "self" | "delegated"),

  setMode: (mode: "self" | "delegated") =>
    request("/api/v1/user/signing-mode", {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),

  sign: (xdr: string, networkPassphrase: string) =>
    request("/api/v1/transactions/sign", {
      method: "POST",
      body: JSON.stringify({ xdr, networkPassphrase }),
    }),

  signAndSubmit: (xdr: string, networkPassphrase: string) =>
    request("/api/v1/transactions/sign-and-submit", {
      method: "POST",
      body: JSON.stringify({ xdr, networkPassphrase }),
    }),
};