import { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

export async function walletRoutes(app: FastifyInstance) {
  // ──────────────────────────────────────────
  // GET USER WALLETS
  // ──────────────────────────────────────────
  app.get("/api/v1/wallets", {
      preHandler: authMiddleware,
      schema: {
        description: "List all wallets for the authenticated user.",
        tags: ["Wallets"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  userId: { type: "number" },
                  name: { type: "string" },
                  publicKey: { type: "string" },
                  network: { type: "string" },
                  isActive: { type: "boolean" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
          },
        },
      },
    }, async (request) => {
    const userId = request.user!.userId;

    const wallets = await db
      .select()
      .from(schema.userWallets)
      .where(eq(schema.userWallets.userId, userId));

    return wallets;
  });

  // ──────────────────────────────────────────
  // ADD WALLET
  // ──────────────────────────────────────────
  app.post("/api/v1/wallets", {
      preHandler: authMiddleware,
      schema: {
        description: "Add a new wallet. Becomes the active wallet; all others are deactivated.",
        tags: ["Wallets"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "publicKey"],
          properties: {
            name: { type: "string", description: "Display name for the wallet" },
            publicKey: { type: "string", description: "Stellar public key (G...)" },
            encryptedSecret: { type: "string", description: "AES-GCM encrypted secret key (for delegated mode)" },
            network: { type: "string", enum: ["testnet", "mainnet"], default: "testnet" },
          },
        },
        response: {
          200: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  userId: { type: "number" },
                  name: { type: "string" },
                  publicKey: { type: "string" },
                  network: { type: "string" },
                  isActive: { type: "boolean" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
          400: { type: "object", properties: { error: { type: "string" } } },
          409: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const userId = request.user!.userId;
    const { name, publicKey, encryptedSecret, network } = request.body as {
      name: string;
      publicKey: string;
      encryptedSecret?: string;
      network?: string;
    };

    if (!name || !publicKey) {
      return reply.status(400).send({ error: "Name and publicKey are required" });
    }

    // Check if wallet already exists for this user
    const existing = await db
      .select({ id: schema.userWallets.id })
      .from(schema.userWallets)
      .where(
        and(
          eq(schema.userWallets.userId, userId),
          eq(schema.userWallets.publicKey, publicKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({ error: "Wallet already exists" });
    }

    // Check for duplicate name
    const duplicateName = await db
      .select({ id: schema.userWallets.id })
      .from(schema.userWallets)
      .where(
        and(
          eq(schema.userWallets.userId, userId),
          eq(schema.userWallets.name, name)
        )
      )
      .limit(1);

    if (duplicateName.length > 0) {
      return reply.status(409).send({ error: "A wallet with this name already exists" });
    }

    // Deactivate other wallets
    await db
      .update(schema.userWallets)
      .set({ isActive: false })
      .where(eq(schema.userWallets.userId, userId));

    const [wallet] = await db
      .insert(schema.userWallets)
      .values({
        userId,
        name,
        publicKey,
        encryptedSecret: encryptedSecret || null,
        network: network || "testnet",
        isActive: true,
      })
      .returning();

    return wallet;
  });

  // ──────────────────────────────────────────
  // SET ACTIVE WALLET
  // ──────────────────────────────────────────
  app.patch("/api/v1/wallets/:id/activate", {
      preHandler: authMiddleware,
      schema: {
        description: "Set a wallet as the active wallet. Deactivates all others.",
        tags: ["Wallets"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", description: "Wallet ID" },
          },
        },
        response: {
          200: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  userId: { type: "number" },
                  name: { type: "string" },
                  publicKey: { type: "string" },
                  network: { type: "string" },
                  isActive: { type: "boolean" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    // Deactivate all
    await db
      .update(schema.userWallets)
      .set({ isActive: false })
      .where(eq(schema.userWallets.userId, userId));

    // Activate selected
    const [wallet] = await db
      .update(schema.userWallets)
      .set({ isActive: true })
      .where(
        and(
          eq(schema.userWallets.id, parseInt(id)),
          eq(schema.userWallets.userId, userId)
        )
      )
      .returning();

    if (!wallet) {
      return reply.status(404).send({ error: "Wallet not found" });
    }

    return wallet;
  });

  // ──────────────────────────────────────────
  // RENAME WALLET
  // ──────────────────────────────────────────
  app.patch("/api/v1/wallets/:id", {
      preHandler: authMiddleware,
      schema: {
        description: "Rename a wallet.",
        tags: ["Wallets"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", description: "Wallet ID" },
          },
        },
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "New wallet name" },
          },
        },
        response: {
          200: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  userId: { type: "number" },
                  name: { type: "string" },
                  publicKey: { type: "string" },
                  network: { type: "string" },
                  isActive: { type: "boolean" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };

    const [wallet] = await db
      .update(schema.userWallets)
      .set({ name })
      .where(
        and(
          eq(schema.userWallets.id, parseInt(id)),
          eq(schema.userWallets.userId, userId)
        )
      )
      .returning();

    if (!wallet) {
      return reply.status(404).send({ error: "Wallet not found" });
    }

    return wallet;
  });

  // ──────────────────────────────────────────
  // DELETE WALLET
  // ──────────────────────────────────────────
  app.delete("/api/v1/wallets/:id", {
      preHandler: authMiddleware,
      schema: {
        description: "Delete a wallet. If it was active, another wallet is auto-activated.",
        tags: ["Wallets"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", description: "Wallet ID" },
          },
        },
        response: {
          200: { type: "object", properties: { ok: { type: "boolean" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const [deleted] = await db
      .delete(schema.userWallets)
      .where(
        and(
          eq(schema.userWallets.id, parseInt(id)),
          eq(schema.userWallets.userId, userId)
        )
      )
      .returning();

    if (!deleted) {
      return reply.status(404).send({ error: "Wallet not found" });
    }

    // If we deleted the active wallet, activate another one
    const remaining = await db
      .select()
      .from(schema.userWallets)
      .where(eq(schema.userWallets.userId, userId))
      .limit(1);

    if (remaining.length > 0) {
      await db
        .update(schema.userWallets)
        .set({ isActive: true })
        .where(eq(schema.userWallets.id, remaining[0].id));
    }

    return { ok: true };
  });
}
