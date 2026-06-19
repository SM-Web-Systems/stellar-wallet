import "dotenv/config";
import Fastify from "fastify";
import fastifyStatic from '@fastify/static';
import path from 'path';
import * as StellarSdk from "@stellar/stellar-sdk";
import cors from "@fastify/cors";
import { config } from "./config/index.js";
import { TokenService } from "./modules/tokens/token.service";
import { SwapService } from "./modules/swap/swap.service";
import { runTokenIndexer } from "./jobs/token-indexer";
import { syncTomlImages } from "./lib/toml-sync.js";
import { authRoutes } from "./routes/auth";
import { walletRoutes } from "./routes/wallets";
import { passwordResetRoutes } from "./routes/password-reset";
import { trustlineRoutes } from "./routes/trustlines";
import StellarHDWallet from "stellar-hd-wallet";


const app = Fastify({ logger: true });
const tokenService = new TokenService();
const swapService = new SwapService();
const stellar = new StellarSdk.Horizon.Server(config.HORIZON_URL);

async function bootstrap() {
  // CORS
  
  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = [
        "http://localhost:5173",
        "https://ammawallet.com",
        "https://www.ammawallet.com",
        config.WEB_APP_URL,
      ].filter(Boolean);

      // Allow chrome extensions
      if (!origin || allowed.includes(origin) || origin.startsWith("chrome-extension://")) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
  });

  app.register(authRoutes);
  app.register(walletRoutes);
  app.register(passwordResetRoutes);
  app.register(trustlineRoutes);
  app.register(fastifyStatic, {
    root: path.resolve(__dirname, '../assets/icons'),
    prefix: '/assets/icons/',
    decorateReply: false,
  });

  // ═══════════════════════════════════════
  // Health
  // ═══════════════════════════════════════
  app.get("/health", async () => ({
    status: "ok",
    network: config.STELLAR_NETWORK,
    timestamp: new Date().toISOString(),
  }));

  // ═══════════════════════════════════════
  // Token Routes
  // ═══════════════════════════════════════

  // Search / list tokens
  app.get("/api/v1/tokens", async (request) => {
    const { query, sortBy, verified, limit, offset } = request.query as any;
    return tokenService.search({
      query,
      sortBy,
      verified: verified === "true",
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  });

  // Featured tokens
  app.get("/api/v1/tokens/featured", async () => {
    return tokenService.getFeatured();
  });

  // ═══════════════════════════════════════
  // StellarExpert Proxy (avoids CORS)
  // ═══════════════════════════════════════
  app.get("/api/v1/tokens/expert/:code/:issuer", async (request, reply) => {
    const { code, issuer } = request.params as { code: string; issuer: string };

    if (issuer === "native") {
      return reply.status(400).send({ error: "Use backend for native asset" });
    }

    try {
      const res = await fetch(
        `https://api.stellar.expert/explorer/public/asset/${code}-${issuer}`
      );

      if (!res.ok) {
        return reply.status(res.status).send({ error: "Asset not found on StellarExpert" });
      }

      const data = await res.json();
      return reply.send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: err.message || "Failed to fetch from StellarExpert" });
    }
  });

    // StellarExpert directory proxy
  app.get("/api/v1/tokens/directory", async (request, reply) => {
    const { limit, order } = request.query as { limit?: string; order?: string };
    try {
      const res = await fetch(
        `https://api.stellar.expert/explorer/public/asset?order=${order || "desc"}&limit=${limit || "200"}`
      );
      if (!res.ok) return reply.status(res.status).send({ error: "Failed to fetch directory" });
      const data = await res.json();
      return reply.send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  });

  // Single token detail
  app.get("/api/v1/tokens/:code/:issuer", async (request) => {
    const { code, issuer } = request.params as any;
    const token = await tokenService.getDetail(code, issuer === "native" ? null : issuer);
    if (!token) {
      return { error: "Token not found" };
    }
    return token;
  });

  // User's tokens (balances + metadata)
  app.get("/api/v1/tokens/user/:publicKey", async (request) => {
    const { publicKey } = request.params as any;
    try {
      return await tokenService.getUserTokens(publicKey);
    } catch (error: any) {
      return { error: error.message || "Failed to load account" };
    }
  });

  // Toggle favorite
  app.post("/api/v1/tokens/favorite", async (request) => {
    const { publicKey, tokenId } = request.body as any;
    return tokenService.toggleFavorite(publicKey, tokenId);
  });

  // ═══════════════════════════════════════
  // Swap Routes
  // ═══════════════════════════════════════

  // Get swap quotes
  app.get("/api/v1/swap/quote", async (request) => {
    const {
      fromCode, fromIssuer,
      toCode, toIssuer,
      amount, direction,
    } = request.query as any;

    if (!fromCode || !toCode || !amount) {
      return { error: "fromCode, toCode, and amount are required" };
    }

    return swapService.getBestQuote(
      fromCode, fromIssuer || null,
      toCode, toIssuer || null,
      amount,
      direction || "send"
    );
  });

  // Build swap transaction (returns unsigned XDR)
  app.post("/api/v1/swap/build", async (request) => {
    const { publicKey, quote, slippageBps } = request.body as any;

    if (!publicKey || !quote) {
      return { error: "publicKey and quote are required" };
    }

    const xdr = await swapService.buildSwapTransaction(
      publicKey,
      quote,
      slippageBps || 100
    );

    return { xdr, networkPassphrase: config.STELLAR_NETWORK === "testnet"
      ? "Test SDF Network ; September 2015"
      : "Public Global Stellar Network ; September 2015",
    };
  });

  // ═══════════════════════════════════════
  // Wallet Routes
  // ═══════════════════════════════════════

  // Get account info from Horizon
  app.get("/api/v1/wallet/:publicKey", async (request) => {
    const { publicKey } = request.params as any;
    const { stellarClient } = await import("./lib/stellar-client");

    try {
      const account = await stellarClient.horizon.loadAccount(publicKey);
      return {
        publicKey,
        balances: account.balances,
        sequence: account.sequence,
        subentryCount: account.subentry_count,
      };
    } catch (error: any) {
      return { error: "Account not found or not funded" };
    }
  });

  // Fund testnet account
  app.post("/api/v1/wallet/fund", async (request) => {
    const { publicKey } = request.body as any;

    if (config.STELLAR_NETWORK !== "testnet") {
      return { error: "Funding only available on testnet" };
    }

    try {
      const res = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
      );
      const data = await res.json();
      return { success: true, data };
    } catch (error: any) {
      return { error: error.message };
    }
  });

  // ═══════════════════════════════════════
  // Transaction Routes
  // ═══════════════════════════════════════

  // Submit a signed transaction
  app.post("/api/v1/transactions/submit", async (request) => {
    const { signedXdr } = request.body as any;
    const { stellarClient } = await import("./lib/stellar-client");

    try {
      const tx = stellarClient.stellar.decodeTransaction(signedXdr);
      const result = await stellarClient.wallet.stellar().submitTransaction(tx);
      return { success: true, result };
    } catch (error: any) {
      return { error: error.message || "Transaction submission failed" };
    }
  });

  // Transaction history for an account
  app.get("/api/v1/transactions/:publicKey", async (req, res) => {
    const { publicKey } = req.params as { publicKey: string };
    const { limit = "20", cursor } = req.query as { limit?: string; cursor?: string };

    try {
      let builder = stellar
        .operations()
        .forAccount(publicKey)
        .order("desc")
        .limit(parseInt(limit));

      if (cursor) {
        builder = builder.cursor(cursor);
      }

      const response = await builder.call();
      const records = response.records.map((op: any) => ({
        id: op.id,
        type: op.type,
        createdAt: op.created_at,
        transactionHash: op.transaction_hash,
        sourceAccount: op.source_account,
        // Payment fields
        from: op.from || op.source_account || op.funder || "",
        to: op.to || op.account || "",
        amount: op.amount || op.starting_balance || "0",
        assetCode: op.asset_code || (op.asset_type === "native" ? "XLM" : ""),
        assetIssuer: op.asset_issuer || "",
        assetType: op.asset_type || "",
      }));

      const nextCursor =
        response.records.length > 0
          ? response.records[response.records.length - 1].paging_token
          : null;

      return res.send({ records, nextCursor });
    } catch (err: any) {
      // Account not found on-chain yet (no transactions)
      if (err?.response?.status === 404) {
        return res.send({ records: [], nextCursor: null });
      }
      req.log.error(err, "Failed to fetch transaction history");
      return res.status(500).send({ error: "Failed to fetch history" });
    }
  });

  // Keypair generation for mobile (no stellar-base in RN)
   app.get("/api/v1/keypair/generate", async () => {
    const pair = StellarSdk.Keypair.random();
    return { publicKey: pair.publicKey(), secretKey: pair.secret() };
  });

  app.post("/api/v1/keypair/from-secret", async (request, reply) => {
    try {
      const { secret } = request.body as any;
      const pair = StellarSdk.Keypair.fromSecret(secret);
      return { publicKey: pair.publicKey() };
    } catch {
      reply.status(400);
      return { error: "Invalid secret key" };
    }
  });

  app.post("/api/v1/keypair/validate-mnemonic", async (request, reply) => {
    const { mnemonic } = request.body as { mnemonic: string };
    if (!mnemonic || typeof mnemonic !== "string") {
      return reply.status(400).send({ error: "Mnemonic is required" });
    }
    try {
      const isValid = StellarHDWallet.validateMnemonic(mnemonic.trim());
      return { valid: isValid };
    } catch {
      return { valid: false };
    }
  });

  // Derive keypair from mnemonic + account index
  app.post("/api/v1/keypair/from-mnemonic", async (request, reply) => {
    const { mnemonic, accountIndex = 0 } = request.body as {
      mnemonic: string;
      accountIndex?: number;
    };
    if (!mnemonic || typeof mnemonic !== "string") {
      return reply.status(400).send({ error: "Mnemonic is required" });
    }
    try {
      if (!StellarHDWallet.validateMnemonic(mnemonic.trim())) {
        return reply.status(400).send({ error: "Invalid mnemonic phrase" });
      }
      const wallet = StellarHDWallet.fromMnemonic(mnemonic.trim());
      return {
        publicKey: wallet.getPublicKey(accountIndex),
        secretKey: wallet.getSecret(accountIndex),
        accountIndex,
      };
    } catch (e: any) {
      return reply.status(400).send({ error: e.message || "Invalid mnemonic" });
    }
  });

  // ═══════════════════════════════════════
  // Start
  // ═══════════════════════════════════════
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  syncTomlImages().catch(console.error);
  console.log(`\n  Amma Wallet API running on http://localhost:${config.PORT}`);
  console.log(`  Network: ${config.STELLAR_NETWORK}`);
  console.log(`  Horizon: ${config.HORIZON_URL}\n`);

  // Run token indexer on startup, then every 15 min
  runTokenIndexer().catch(console.error);
  setInterval(() => runTokenIndexer().catch(console.error), 15 * 60 * 1000); // Every 15 minutes
  setInterval(() => {syncTomlImages().catch(console.error);}, 6 * 60 * 60 * 1000); // Every 6 hours
}

bootstrap().catch(console.error);
