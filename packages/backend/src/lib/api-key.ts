import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import { pgTable, bigserial, text, timestamp, boolean, bigint, index } from "drizzle-orm/pg-core";

// We'll add this table to the schema, but define the middleware here
import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Middleware: checks x-api-key header against api_keys table.
 * If valid, attaches request.apiKey with metadata.
 */
export async function apiKeyMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const key = request.headers["x-api-key"] as string;

  if (!key) {
    return reply.status(401).send({ error: "Missing x-api-key header" });
  }

  try {
    const [apiKey] = await db
      .select()
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.key, key), eq(schema.apiKeys.isActive, true)))
      .limit(1);

    if (!apiKey) {
      return reply.status(403).send({ error: "Invalid or revoked API key" });
    }

    // Update last used timestamp
    await db
      .update(schema.apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiKeys.id, apiKey.id));

    (request as any).apiKey = apiKey;
  } catch {
    return reply.status(500).send({ error: "API key validation failed" });
  }
}
