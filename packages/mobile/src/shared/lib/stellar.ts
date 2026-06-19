// packages/mobile/src/shared/lib/stellar.ts
import * as StellarSdk from "@stellar/stellar-sdk";
import * as SecureStore from "expo-secure-store";
import { useWalletStore } from "../store/wallet";

const API_BASE = "https://ammawallet.com";

export async function signAndSubmitXdr(
  xdr: string,
  networkPassphrase: string
): Promise<any> {
  // Get the active account's secret key from secure storage
  const store = useWalletStore.getState();
  const activeAccount = store.accounts.find(
    (a) => a.id === store.activeAccountId
  );
  if (!activeAccount) throw new Error("No active wallet");

  const secretKey = await SecureStore.getItemAsync(
    `wallet_secret_${activeAccount.id}`
  );
  if (!secretKey) throw new Error("Secret key not found in secure storage");

  // Parse, sign, submit
  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  tx.sign(keypair);

  const res = await fetch(`${API_BASE}/api/v1/transactions/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedXdr: tx.toXDR() }),
  });

  const result = await res.json();
  if (result.error) throw new Error(result.error);
  return result;
}
