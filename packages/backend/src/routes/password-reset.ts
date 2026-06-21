import { FastifyInstance } from "fastify";
import { randomBytes } from "crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "../db";
import { users, passwordResetTokens } from "../db/schema";
import { hashPassword } from "../lib/auth";
import { sendPasswordResetEmail } from "../lib/email";

export async function passwordResetRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/forgot-password
  app.post("/api/v1/auth/forgot-password", {
      schema: {
        description: "Request a password reset email. Always returns success to prevent email enumeration.",
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    }, async (request, reply) => {
    const { email } = request.body as { email: string };

    if (!email) {
      return reply.status(400).send({ error: "Email is required" });
    }

    // Always return success to prevent email enumeration
    const successMsg = {
      message: "If an account exists with that email, a reset link has been sent.",
    };

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      if (!user) return reply.send(successMsg);

      // Generate a secure random token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store the token
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Send the email
      await sendPasswordResetEmail(user.email, token);

      return reply.send(successMsg);
    } catch (err) {
      console.error("Forgot password error:", err);
      // Still return success to prevent enumeration
      return reply.send(successMsg);
    }
  });

  // POST /api/v1/auth/reset-password
  app.post("/api/v1/auth/reset-password", {
      schema: {
        description: "Reset password using a valid token from the password reset email.",
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: { type: "string", description: "64-char hex reset token from email" },
            password: { type: "string", minLength: 8, description: "New password (min 8 chars)" },
          },
        },
        response: {
          200: { type: "object", properties: { message: { type: "string" } } },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const { token, password } = request.body as {
      token: string;
      password: string;
    };

    if (!token || !password) {
      return reply.status(400).send({ error: "Token and password are required" });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters" });
    }

    // Find valid, unused, non-expired token
    const [resetRecord] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    if (!resetRecord) {
      return reply
        .status(400)
        .send({ error: "Invalid or expired reset token" });
    }

    // Hash new password and update user
    const passwordHash = await hashPassword(password);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, resetRecord.userId));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetRecord.id));

    return reply.send({ message: "Password has been reset successfully" });
  });
}
