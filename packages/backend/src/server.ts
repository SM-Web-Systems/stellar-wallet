import "dotenv/config";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyRateLimit from "@fastify/rate-limit";
import path from "path";
import crypto from "crypto";
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
import { db, schema } from "./db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "./middleware/auth";
import { apiKeyMiddleware } from "./lib/api-key";

const app = Fastify({ logger: true });
const tokenService = new TokenService();
const swapService = new SwapService();
const stellar = new StellarSdk.Horizon.Server(config.HORIZON_URL);

async function bootstrap() {
  // ═══════════════════════════════════════
  // Swagger / OpenAPI
  // ═══════════════════════════════════════
  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Amma Wallet API",
        description:
          "Public REST API for the Amma Stellar Wallet. Provides token data, account info, swap quotes, trustline management, and transaction submission.",
        version: "1.0.0",
        contact: {
          name: "SM Web Systems",
          url: "https://ammawallet.com",
        },
      },
      servers: [
        { url: "https://ammawallet.com", description: "Production" },
        { url: "http://localhost:3001", description: "Local development" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT access token from /api/v1/auth/login",
          },
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description: "API key for public API access",
          },
        },
      },
      tags: [
        { name: "Health", description: "Server health check" },
        { name: "Auth", description: "Authentication & user management" },
        { name: "Tokens", description: "Token registry, search, and metadata" },
        { name: "Wallet", description: "Wallet account info and funding" },
        { name: "Trustlines", description: "Stellar trustline management" },
        { name: "Swap", description: "DEX swap quotes and execution" },
        { name: "Transactions", description: "Transaction submission and history" },
        { name: "Keypair", description: "Keypair generation and derivation" },
        { name: "Signing", description: "Delegated signing mode" },
        { name: "API Keys", description: "API key management" },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
    },
  });

  // ═══════════════════════════════════════
  // Rate Limiting
  // ═══════════════════════════════════════
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      // Use API key if present, otherwise IP
      const apiKey = request.headers["x-api-key"] as string;
      return apiKey || request.ip;
    },
    errorResponseBuilder: () => ({
      error: "Too many requests. Please slow down.",
      statusCode: 429,
    }),
  });

  // CORS
  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = [
        "http://localhost:5173",
        "https://ammawallet.com",
        "https://www.ammawallet.com",
        config.WEB_APP_URL,
      ].filter(Boolean);

      if (
        !origin ||
        allowed.includes(origin) ||
        origin.startsWith("chrome-extension://")
      ) {
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
    root: path.resolve(__dirname, "../assets/icons"),
    prefix: "/assets/icons/",
    decorateReply: false,
  });

  // ═══════════════════════════════════════
  // Health
  // ═══════════════════════════════════════
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Server health check",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", example: "ok" },
              network: { type: "string", example: "testnet" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async () => ({
      status: "ok",
      network: config.STELLAR_NETWORK,
      timestamp: new Date().toISOString(),
    })
  );

  // ═══════════════════════════════════════
  // Token Routes
  // ═══════════════════════════════════════

  app.get(
    "/api/v1/tokens",
    {
      schema: {
        tags: ["Tokens"],
        summary: "Search and list tokens",
        querystring: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search by code or name" },
            sortBy: { type: "string", description: "Sort field" },
            verified: { type: "string", enum: ["true", "false"] },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
    },
    async (request) => {
      const { query, sortBy, verified, limit, offset } = request.query as any;
      return tokenService.search({
        query,
        sortBy,
        verified: verified === "true",
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
      });
    }
  );

  app.get(
    "/api/v1/tokens/featured",
    {
      schema: {
        tags: ["Tokens"],
        summary: "Get featured tokens",
      },
    },
    async () => {
      return tokenService.getFeatured();
    }
  );

  // ═══════════════════════════════════════
  // StellarExpert Proxy
  // ═══════════════════════════════════════
  app.get(
    "/api/v1/tokens/expert/:code/:issuer",
    {
      schema: {
        tags: ["Tokens"],
        summary: "Proxy to StellarExpert asset data",
        params: {
          type: "object",
          properties: {
            code: { type: "string" },
            issuer: { type: "string" },
          },
          required: ["code", "issuer"],
        },
      },
    },
    async (request, reply) => {
      const { code, issuer } = request.params as {
        code: string;
        issuer: string;
      };

      if (issuer === "native") {
        return reply
          .status(400)
          .send({ error: "Use backend for native asset" });
      }

      try {
        const res = await fetch(
          `https://api.stellar.expert/explorer/public/asset/${code}-${issuer}`
        );
        if (!res.ok) {
          return reply
            .status(res.status)
            .send({ error: "Asset not found on StellarExpert" });
        }
        const data = await res.json();
        return reply.send(data);
      } catch (err: any) {
        return reply
          .status(502)
          .send({ error: err.message || "Failed to fetch from StellarExpert" });
      }
    }
  );

  app.get(
    "/api/v1/tokens/directory",
    {
      schema: {
        tags: ["Tokens"],
        summary: "StellarExpert asset directory proxy",
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string", default: "200" },
            order: { type: "string", default: "desc" },
          },
        },
      },
    },
    async (request, reply) => {
      const { limit, order } = request.query as {
        limit?: string;
        order?: string;
      };
      try {
        const res = await fetch(
          `https://api.stellar.expert/explorer/public/asset?order=${order || "desc"}&limit=${limit || "200"}`
        );
        if (!res.ok)
          return reply
            .status(res.status)
            .send({ error: "Failed to fetch directory" });
        const data = await res.json();
        return reply.send(data);
      } catch (err: any) {
        return reply.status(502).send({ error: err.message });
      }
    }
  );

  app.get(
    "/api/v1/tokens/:code/:issuer",
    {
      schema: {
        tags: ["Tokens"],
        summary: "Get single token detail",
        params: {
          type: "object",
          properties: {
            code: { type: "string" },
            issuer: { type: "string", description: 'Use "native" for XLM' },
          },
          required: ["code", "issuer"],
        },
      },
    },
    async (request) => {
      const { code, issuer } = request.params as any;
      const token = await tokenService.getDetail(
        code,
        issuer === "native" ? null : issuer
      );
      if (!token) return { error: "Token not found" };
      return token;
    }
  );

  app.get(
    "/api/v1/tokens/user/:publicKey",
    {
      schema: {
        tags: ["Tokens"],
        summary: "Get user token balances with metadata",
        params: {
          type: "object",
          properties: {
            publicKey: { type: "string", description: "Stellar public key" },
          },
          required: ["publicKey"],
        },
      },
    },
    async (request) => {
      const { publicKey } = request.params as any;
      try {
        return await tokenService.getUserTokens(publicKey);
      } catch (error: any) {
        return { error: error.message || "Failed to load account" };
      }
    }
  );

  app.post(
    "/api/v1/tokens/favorite",
    {
      schema: {
        tags: ["Tokens"],
        summary: "Toggle token favorite status",
        body: {
          type: "object",
          properties: {
            publicKey: { type: "string" },
            tokenId: { type: "integer" },
          },
          required: ["publicKey", "tokenId"],
        },
      },
    },
    async (request) => {
      const { publicKey, tokenId } = request.body as any;
      return tokenService.toggleFavorite(publicKey, tokenId);
    }
  );

  // ═══════════════════════════════════════
  // Swap Routes
  // ═══════════════════════════════════════

  app.get(
    "/api/v1/swap/quote",
    {
      schema: {
        tags: ["Swap"],
        summary: "Get swap quote",
        querystring: {
          type: "object",
          properties: {
            fromCode: { type: "string" },
            fromIssuer: { type: "string" },
            toCode: { type: "string" },
            toIssuer: { type: "string" },
            amount: { type: "string" },
            direction: { type: "string", enum: ["send", "receive"], default: "send" },
          },
          required: ["fromCode", "toCode", "amount"],
        },
      },
    },
    async (request) => {
      const { fromCode, fromIssuer, toCode, toIssuer, amount, direction } =
        request.query as any;

      if (!fromCode || !toCode || !amount) {
        return { error: "fromCode, toCode, and amount are required" };
      }

      return swapService.getBestQuote(
        fromCode,
        fromIssuer || null,
        toCode,
        toIssuer || null,
        amount,
        direction || "send"
      );
    }
  );

  app.post(
    "/api/v1/swap/build",
    {
      schema: {
        tags: ["Swap"],
        summary: "Build unsigned swap transaction XDR",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            publicKey: { type: "string" },
            quote: { type: "object" },
            slippageBps: { type: "integer", default: 100 },
          },
          required: ["publicKey", "quote"],
        },
      },
    },
    async (request) => {
      const { publicKey, quote, slippageBps } = request.body as any;

      if (!publicKey || !quote) {
        return { error: "publicKey and quote are required" };
      }

      const xdr = await swapService.buildSwapTransaction(
        publicKey,
        quote,
        slippageBps || 100
      );

      return {
        xdr,
        networkPassphrase:
          config.STELLAR_NETWORK === "testnet"
            ? "Test SDF Network ; September 2015"
            : "Public Global Stellar Network ; September 2015",
      };
    }
  );

  // ═══════════════════════════════════════
  // Wallet Routes
  // ═══════════════════════════════════════

  app.get(
    "/api/v1/wallet/:publicKey",
    {
      schema: {
        tags: ["Wallet"],
        summary: "Get account info from Horizon",
        params: {
          type: "object",
          properties: {
            publicKey: { type: "string" },
          },
          required: ["publicKey"],
        },
      },
    },
    async (request) => {
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
    }
  );

  app.post(
    "/api/v1/wallet/fund",
    {
      schema: {
        tags: ["Wallet"],
        summary: "Fund testnet account via Friendbot",
        body: {
          type: "object",
          properties: {
            publicKey: { type: "string" },
          },
          required: ["publicKey"],
        },
      },
    },
    async (request) => {
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
    }
  );

  // ═══════════════════════════════════════
  // Transaction Routes
  // ═══════════════════════════════════════

  app.post(
    "/api/v1/transactions/submit",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Submit a signed transaction",
        body: {
          type: "object",
          properties: {
            signedXdr: { type: "string", description: "Signed transaction XDR" },
          },
          required: ["signedXdr"],
        },
      },
    },
    async (request) => {
      const { signedXdr } = request.body as any;
      const { stellarClient } = await import("./lib/stellar-client");

      try {
        const tx = stellarClient.stellar.decodeTransaction(signedXdr);
        const result = await stellarClient.wallet
          .stellar()
          .submitTransaction(tx);
        return { success: true, result };
      } catch (error: any) {
        return { error: error.message || "Transaction submission failed" };
      }
    }
  );

  // ═══════════════════════════════════════
  // Delegated Signing
  // ═══════════════════════════════════════
  app.post(
    "/api/v1/transactions/sign",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["Signing"],
        summary: "Server-side transaction signing (delegated mode)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            xdr: { type: "string", description: "Unsigned transaction XDR" },
            networkPassphrase: { type: "string" },
          },
          required: ["xdr"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { xdr, networkPassphrase: clientPassphrase } = request.body as {
        xdr: string;
        networkPassphrase?: string;
      };

      if (!xdr) {
        return reply.status(400).send({ error: "xdr is required" });
      }

      try {
        const [user] = await db
          .select({ signingMode: schema.users.signingMode })
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);

        if (!user || user.signingMode !== "delegated") {
          return reply.status(403).send({
            error:
              "Delegated signing is not enabled. Enable it in Settings → Signing Mode.",
          });
        }

        const [wallet] = await db
          .select()
          .from(schema.userWallets)
          .where(
            and(
              eq(schema.userWallets.userId, userId),
              eq(schema.userWallets.isActive, true)
            )
          )
          .limit(1);

        if (!wallet) {
          return reply.status(404).send({ error: "No active wallet found" });
        }

        if (!wallet.encryptedSecret) {
          return reply.status(400).send({
            error:
              "No secret key stored on server for this wallet. Re-import your wallet to enable delegated signing.",
          });
        }

        const { stellarClient } = await import("./lib/stellar-client");
        const passphrase = clientPassphrase || stellarClient.networkPassphrase;

        const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, passphrase);

        const txSource =
          tx instanceof StellarSdk.FeeBumpTransaction
            ? tx.innerTransaction.source
            : tx.source;
        if (txSource !== wallet.publicKey) {
          return reply.status(403).send({
            error: "Transaction source does not match your active wallet",
          });
        }

        const keypair = StellarSdk.Keypair.fromSecret(wallet.encryptedSecret);
        tx.sign(keypair);

        const signedXdr = tx.toXDR();

        return { signedXdr, networkPassphrase: passphrase };
      } catch (error: any) {
        return reply.status(500).send({
          error: error.message || "Failed to sign transaction",
        });
      }
    }
  );

  app.post(
    "/api/v1/transactions/sign-and-submit",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["Signing"],
        summary: "Server-side sign and submit (delegated mode)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            xdr: { type: "string" },
            networkPassphrase: { type: "string" },
          },
          required: ["xdr"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { xdr, networkPassphrase: clientPassphrase } = request.body as {
        xdr: string;
        networkPassphrase?: string;
      };

      if (!xdr) {
        return reply.status(400).send({ error: "xdr is required" });
      }

      try {
        const [user] = await db
          .select({ signingMode: schema.users.signingMode })
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);

        if (!user || user.signingMode !== "delegated") {
          return reply
            .status(403)
            .send({ error: "Delegated signing is not enabled." });
        }

        const [wallet] = await db
          .select()
          .from(schema.userWallets)
          .where(
            and(
              eq(schema.userWallets.userId, userId),
              eq(schema.userWallets.isActive, true)
            )
          )
          .limit(1);

        if (!wallet || !wallet.encryptedSecret) {
          return reply
            .status(400)
            .send({ error: "No secret key stored on server" });
        }

        const { stellarClient } = await import("./lib/stellar-client");
        const passphrase = clientPassphrase || stellarClient.networkPassphrase;

        const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, passphrase);

        const txSource =
          tx instanceof StellarSdk.FeeBumpTransaction
            ? tx.innerTransaction.source
            : tx.source;
        if (txSource !== wallet.publicKey) {
          return reply.status(403).send({
            error: "Transaction source does not match your active wallet",
          });
        }

        const keypair = StellarSdk.Keypair.fromSecret(wallet.encryptedSecret);
        tx.sign(keypair);

        const result = await stellarClient.wallet
          .stellar()
          .submitTransaction(
            stellarClient.stellar.decodeTransaction(tx.toXDR())
          );

        return { success: true, result };
      } catch (error: any) {
        return reply.status(500).send({
          error: error.message || "Failed to sign and submit",
        });
      }
    }
  );

  app.patch(
    "/api/v1/user/signing-mode",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["Signing"],
        summary: "Update signing mode preference",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["self", "delegated"] },
          },
          required: ["mode"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { mode } = request.body as { mode: string };

      if (mode !== "self" && mode !== "delegated") {
        return reply
          .status(400)
          .send({ error: "Mode must be 'self' or 'delegated'" });
      }

      if (mode === "delegated") {
        const [wallet] = await db
          .select({ encryptedSecret: schema.userWallets.encryptedSecret })
          .from(schema.userWallets)
          .where(
            and(
              eq(schema.userWallets.userId, userId),
              eq(schema.userWallets.isActive, true)
            )
          )
          .limit(1);

        if (!wallet?.encryptedSecret) {
          return reply.status(400).send({
            error:
              "Cannot enable delegated signing: no secret key stored on server for your active wallet.",
          });
        }
      }

      await db
        .update(schema.users)
        .set({ signingMode: mode, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));

      return { signingMode: mode };
    }
  );

  app.get(
    "/api/v1/user/signing-mode",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["Signing"],
        summary: "Get current signing mode",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const userId = request.user!.userId;

      const [user] = await db
        .select({ signingMode: schema.users.signingMode })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      return { signingMode: user?.signingMode || "self" };
    }
  );

  // Transaction history
  app.get(
    "/api/v1/transactions/:publicKey",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Get transaction history for an account",
        params: {
          type: "object",
          properties: {
            publicKey: { type: "string" },
          },
          required: ["publicKey"],
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string", default: "20" },
            cursor: { type: "string" },
          },
        },
      },
    },
    async (req, res) => {
      const { publicKey } = req.params as { publicKey: string };
      const { limit = "20", cursor } = req.query as {
        limit?: string;
        cursor?: string;
      };

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
          from: op.from || op.source_account || op.funder || "",
          to: op.to || op.account || "",
          amount: op.amount || op.starting_balance || "0",
          assetCode:
            op.asset_code || (op.asset_type === "native" ? "XLM" : ""),
          assetIssuer: op.asset_issuer || "",
          assetType: op.asset_type || "",
        }));

        const nextCursor =
          response.records.length > 0
            ? response.records[response.records.length - 1].paging_token
            : null;

        return res.send({ records, nextCursor });
      } catch (err: any) {
        if (err?.response?.status === 404) {
          return res.send({ records: [], nextCursor: null });
        }
        req.log.error(err, "Failed to fetch transaction history");
        return res.status(500).send({ error: "Failed to fetch history" });
      }
    }
  );

  // ═══════════════════════════════════════
  // Keypair Routes
  // ═══════════════════════════════════════

  app.get(
    "/api/v1/keypair/generate",
    {
      schema: {
        tags: ["Keypair"],
        summary: "Generate a random Stellar keypair",
      },
    },
    async () => {
      const pair = StellarSdk.Keypair.random();
      return { publicKey: pair.publicKey(), secretKey: pair.secret() };
    }
  );

  app.post(
    "/api/v1/keypair/from-secret",
    {
      schema: {
        tags: ["Keypair"],
        summary: "Derive public key from secret key",
        body: {
          type: "object",
          properties: {
            secret: { type: "string" },
          },
          required: ["secret"],
        },
      },
    },
    async (request, reply) => {
      try {
        const { secret } = request.body as any;
        const pair = StellarSdk.Keypair.fromSecret(secret);
        return { publicKey: pair.publicKey() };
      } catch {
        reply.status(400);
        return { error: "Invalid secret key" };
      }
    }
  );

  app.post(
    "/api/v1/keypair/validate-mnemonic",
    {
      schema: {
        tags: ["Keypair"],
        summary: "Validate a BIP-39 mnemonic phrase",
        body: {
          type: "object",
          properties: {
            mnemonic: { type: "string" },
          },
          required: ["mnemonic"],
        },
      },
    },
    async (request, reply) => {
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
    }
  );

  app.post(
    "/api/v1/keypair/from-mnemonic",
    {
      schema: {
        tags: ["Keypair"],
        summary: "Derive keypair from mnemonic (SEP-0005)",
        body: {
          type: "object",
          properties: {
            mnemonic: { type: "string" },
            accountIndex: { type: "integer", default: 0 },
          },
          required: ["mnemonic"],
        },
      },
    },
    async (request, reply) => {
      const { mnemonic, accountIndex = 0 } = request.body as {
        mnemonic: string;
        accountIndex?: number;
      };
      if (!mnemonic || typeof mnemonic !== "string") {
        return reply.status(400).send({ error: "Mnemonic is required" });
      }
      try {
        if (!StellarHDWallet.validateMnemonic(mnemonic.trim())) {
          return reply
            .status(400)
            .send({ error: "Invalid mnemonic phrase" });
        }
        const wallet = StellarHDWallet.fromMnemonic(mnemonic.trim());
        return {
          publicKey: wallet.getPublicKey(accountIndex),
          secretKey: wallet.getSecret(accountIndex),
          accountIndex,
        };
      } catch (e: any) {
        return reply
          .status(400)
          .send({ error: e.message || "Invalid mnemonic" });
      }
    }
  );

  // ═══════════════════════════════════════
  // API Key Management
  // ═══════════════════════════════════════

  app.post(
    "/api/v1/api-keys",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["API Keys"],
        summary: "Create a new API key",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", description: "Friendly name for this key" },
          },
          required: ["name"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { name } = request.body as { name: string };

      if (!name || name.trim().length === 0) {
        return reply.status(400).send({ error: "Name is required" });
      }

      const key = `amma_${crypto.randomBytes(32).toString("hex")}`;

      const [apiKey] = await db
        .insert(schema.apiKeys)
        .values({
          userId,
          name: name.trim(),
          key,
        })
        .returning();

      return {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key,
        createdAt: apiKey.createdAt,
        message:
          "Store this key securely — it will not be shown again in full.",
      };
    }
  );

  app.get(
    "/api/v1/api-keys",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["API Keys"],
        summary: "List your API keys",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const userId = request.user!.userId;

      const keys = await db
        .select({
          id: schema.apiKeys.id,
          name: schema.apiKeys.name,
          keyPreview: schema.apiKeys.key,
          isActive: schema.apiKeys.isActive,
          lastUsedAt: schema.apiKeys.lastUsedAt,
          createdAt: schema.apiKeys.createdAt,
        })
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.userId, userId));

      return keys.map((k) => ({
        ...k,
        keyPreview: `${k.keyPreview.slice(0, 10)}...${k.keyPreview.slice(-4)}`,
      }));
    }
  );

  app.delete(
    "/api/v1/api-keys/:id",
    {
      preHandler: authMiddleware,
      schema: {
        tags: ["API Keys"],
        summary: "Revoke an API key",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { id } = request.params as { id: string };

      const result = await db
        .update(schema.apiKeys)
        .set({ isActive: false })
        .where(
          and(
            eq(schema.apiKeys.id, parseInt(id)),
            eq(schema.apiKeys.userId, userId)
          )
        )
        .returning();

      if (result.length === 0) {
        return reply.status(404).send({ error: "API key not found" });
      }

      return { success: true, message: "API key revoked" };
    }
  );

  // ═══════════════════════════════════════
  // Start
  // ═══════════════════════════════════════
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  syncTomlImages().catch(console.error);
  console.log(
    `\n  Amma Wallet API running on http://localhost:${config.PORT}`
  );
  console.log(`  Network: ${config.STELLAR_NETWORK}`);
  console.log(`  Horizon: ${config.HORIZON_URL}`);
  console.log(`  API Docs: http://localhost:${config.PORT}/docs\n`);

  // Run token indexer on startup, then every 15 min
  runTokenIndexer().catch(console.error);
  setInterval(
    () => runTokenIndexer().catch(console.error),
    15 * 60 * 1000
  );
  setInterval(() => {
    syncTomlImages().catch(console.error);
  }, 6 * 60 * 60 * 1000);
}

bootstrap().catch(console.error);
