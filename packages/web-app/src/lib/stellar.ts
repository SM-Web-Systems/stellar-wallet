import * as StellarSdk from "@stellar/stellar-sdk";
import { getNetworkConfig, HORIZON_URL } from "./constants";
import { signingApi, txApi } from "./api";
import { useAuthStore } from "../store/auth";
import { useWalletStore } from "../store/wallet";

// Default server (testnet) — used as fallback
const defaultServer = new StellarSdk.Horizon.Server(HORIZON_URL);

/**
 * Get the Horizon server for the current network.
 */
function getServer(): StellarSdk.Horizon.Server {
  const network = useWalletStore.getState().network;
  const config = getNetworkConfig(network);
  return new StellarSdk.Horizon.Server(config.horizonUrl);
}

/**
 * Get the network passphrase for the current network.
 */
function getPassphrase(): string {
  const network = useWalletStore.getState().network;
  return getNetworkConfig(network).networkPassphrase;
}

export function generateKeypair() {
  const pair = StellarSdk.Keypair.random();
  return { publicKey: pair.publicKey(), secretKey: pair.secret() };
}

export function keypairFromSecret(secret: string) {
  const pair = StellarSdk.Keypair.fromSecret(secret);
  return { publicKey: pair.publicKey(), secretKey: pair.secret() };
}

export async function fundTestnet(publicKey: string) {
  const network = useWalletStore.getState().network;
  if (network === "public") throw new Error("Friendbot is not available on mainnet");
  const config = getNetworkConfig(network);
  const res = await fetch(`${config.friendbotUrl}?addr=${publicKey}`);
  if (!res.ok) throw new Error("Friendbot funding failed");
  return res.json();
}

export async function loadAccount(publicKey: string) {
  return getServer().loadAccount(publicKey);
}

function getSigningMode(): "self" | "delegated" {
  const state = useAuthStore.getState();
  return state.signingMode === "delegated" ? "delegated" : "self";
}

export async function signAndSubmitXdr(
  xdr: string,
  networkPassphrase: string,
  secretKey: string
): Promise<any> {
  const mode = getSigningMode();
  if (mode === "delegated") {
    return signingApi.signAndSubmit(xdr, networkPassphrase);
  }
  return signAndSubmitLocal(xdr, networkPassphrase, secretKey);
}

async function signAndSubmitLocal(
  xdr: string,
  networkPassphrase: string,
  secretKey: string
): Promise<any> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
  if (tx instanceof StellarSdk.FeeBumpTransaction) {
    throw new Error("Fee bump transactions are not supported for local signing");
  }
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  tx.sign(keypair);
  return txApi.submit(tx.toXDR());
}

export function signXdr(xdr: string, secretKey: string): string {
  const passphrase = getPassphrase();
  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, passphrase);
  if (tx instanceof StellarSdk.FeeBumpTransaction) {
    throw new Error("Fee bump transactions are not supported for local signing");
  }
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  tx.sign(keypair);
  return tx.toXDR();
}

// Platform fee config
const PLATFORM_WALLET = "GCGR5XQPJM5D4VQGLOJ7VIFVKXSYLGOG5WCJQXJRSZGBMPKZWIRC4G6H";
const PLATFORM_FEE_PERCENT = 0.1; // 0.1%

export function calculatePlatformFee(amount: string): string {
  const fee = (parseFloat(amount) * PLATFORM_FEE_PERCENT / 100);
  return fee > 0.0000001 ? fee.toFixed(7) : "0";
}

export async function buildPaymentTx(
  senderSecret: string,
  destination: string,
  amount: string,
  assetCode = "XLM",
  assetIssuer?: string
) {
  const srv = getServer();
  const passphrase = getPassphrase();
  const keypair = StellarSdk.Keypair.fromSecret(senderSecret);
  const account = await srv.loadAccount(keypair.publicKey());
  const asset =
    assetCode === "XLM"
      ? StellarSdk.Asset.native()
      : new StellarSdk.Asset(assetCode, assetIssuer!);

  // Calculate fee WITHIN the amount (recipient gets less)
  const feeAmount = calculatePlatformFee(amount);
  const netAmount = feeAmount !== "0"
    ? (parseFloat(amount) - parseFloat(feeAmount)).toFixed(7)
    : amount;

  const builder = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(StellarSdk.Operation.payment({ destination, asset, amount: netAmount }));

  // Platform fee from the same total
  if (feeAmount !== "0" && PLATFORM_WALLET) {
    builder.addOperation(
      StellarSdk.Operation.payment({
        destination: PLATFORM_WALLET,
        asset,
        amount: feeAmount,
      })
    );
  }

  const tx = builder.setTimeout(180).build();
  tx.sign(keypair);
  return srv.submitTransaction(tx);
}

export async function buildTrustlineTx(senderSecret: string, assetCode: string, assetIssuer: string) {
  const srv = getServer();
  const passphrase = getPassphrase();
  const keypair = StellarSdk.Keypair.fromSecret(senderSecret);
  const account = await srv.loadAccount(keypair.publicKey());
  const asset = new StellarSdk.Asset(assetCode, assetIssuer);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset }))
    .setTimeout(180)
    .build();

  tx.sign(keypair);
  return srv.submitTransaction(tx);
}

// Export for backwards compat
export const server = defaultServer;
export { StellarSdk };
