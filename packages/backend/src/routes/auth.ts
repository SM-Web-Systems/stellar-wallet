import { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  validateStoredRefreshToken,
  verifyRefreshToken,
} from "../lib/auth";
import { authMiddleware } from "../middleware/auth";
import speakeasy from "speakeasy";
import { randomBytes } from "crypto";
import crypto from "crypto";
import { verifyTurnstile } from "../middleware/turnstile";
import { sendVerificationEmail } from "../lib/email";

export async function authRoutes(app: FastifyInstance) {
  // ──────────────────────────────────────────
  // REGISTER
  // ──────────────────────────────────────────
  app.post("/api/v1/auth/register", {
      preHandler: verifyTurnstile,
      schema: {
        description: "Register a new user account. Returns JWT tokens and user profile.",
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", description: "User email address" },
            password: { type: "string", minLength: 8, description: "Password (min 8 characters)" },
            firstName: { type: "string", description: "First name (optional)" },
            lastName: { type: "string", description: "Last name (optional)" },
            turnstileToken: { type: "string", description: "Cloudflare Turnstile token" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  email: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                },
              },
              accessToken: { type: "string" },
              refreshToken: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          409: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const { email, password, firstName, lastName } = request.body as {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters" });
    }

    // Check if user exists
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(schema.users)
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
      });

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
    await storeRefreshToken(user.id, refreshToken);

    // Send verification email
    try {
      const verifyToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await db.execute(
        sql`INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (${user.id}, ${verifyToken}, ${expiresAt})`
      );
      await sendVerificationEmail(user.email, verifyToken);
    } catch (emailErr) {
      console.error("[register] Failed to send verification email:", emailErr);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: false,
      },
      accessToken,
      refreshToken,
    };
  });

  // ──────────────────────────────────────────
  // LOGIN
  // ──────────────────────────────────────────
  app.post("/api/v1/auth/login", {
      preHandler: verifyTurnstile,
      schema: {
        description: "Authenticate user. If 2FA is enabled, first call returns twoFaRequired:true, then re-call with twoFaToken.",
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
            turnstileToken: { type: "string", description: "Cloudflare Turnstile token" },
            twoFaToken: { type: "string", description: "6-digit TOTP/email/static code or 8-char backup code (required if 2FA enabled)" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  email: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  avatar: { type: "string", nullable: true },
                  preferredLanguage: { type: "string" },
                  preferredNetwork: { type: "string" },
                },
              },
              accessToken: { type: "string" },
              refreshToken: { type: "string" },
              twoFaRequired: { type: "boolean", description: "True if 2FA code is needed" },
              twoFaMethod: { type: "string", enum: ["totp", "email", "static"], description: "Which 2FA method is active" },
              message: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password are required" });
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    // Check if 2FA is enabled
    if (user.twoFaEnabled) {
      const { twoFaToken } = request.body as any;
      const method = user.twoFaMethod || "totp";

      if (!twoFaToken) {
        // For email method, send a code automatically
        if (method === "email") {
          const { send2FACode } = await import("../lib/mailer");
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          await db.insert(schema.emailCodes).values({
            userId: user.id,
            code,
            type: "login",
            expiresAt,
          });
          await send2FACode(user.email, code);
        }

        return reply.status(200).send({
          twoFaRequired: true,
          twoFaMethod: method,
          message: method === "email"
            ? "A verification code has been sent to your email"
            : method === "static"
            ? "Enter one of your backup codes"
            : "Enter the code from your authenticator app",
        });
      }

      const cleanToken = twoFaToken.replace(/\s/g, "");
      let twoFaValid = false;

      if (method === "totp" && cleanToken.length === 6 && /^\d+$/.test(cleanToken)) {
        twoFaValid = speakeasy.totp.verify({
          secret: user.twoFaSecret!,
          encoding: "base32",
          token: cleanToken,
          window: 2,
        });
      } else if (method === "email") {
        const { and: andOp } = await import("drizzle-orm");
        const [emailCode] = await db.select().from(schema.emailCodes)
          .where(andOp(
            eq(schema.emailCodes.userId, user.id),
            eq(schema.emailCodes.code, cleanToken),
            eq(schema.emailCodes.type, "login"),
            eq(schema.emailCodes.used, false)
          )).limit(1);
        if (emailCode && new Date(emailCode.expiresAt) > new Date()) {
          twoFaValid = true;
          await db.update(schema.emailCodes).set({ used: true }).where(eq(schema.emailCodes.id, emailCode.id));
        }
      } else if (method === "static" && cleanToken.length === 6 && /^\d+$/.test(cleanToken)) {
        const hashedInput = crypto.createHash("sha256").update(cleanToken).digest("hex");
        if (user.twoFaStaticCode === hashedInput) {
          twoFaValid = true;
        }
      }

      // Always allow backup codes as fallback for any method
      if (!twoFaValid && cleanToken.length === 8 && method !== "static") {
        const hashedInput = crypto.createHash("sha256").update(cleanToken.toUpperCase()).digest("hex");
        const storedCodes: string[] = JSON.parse(user.twoFaBackupCodes || "[]");
        const idx = storedCodes.indexOf(hashedInput);
        if (idx !== -1) {
          twoFaValid = true;
          storedCodes.splice(idx, 1);
          await db.update(schema.users).set({ twoFaBackupCodes: JSON.stringify(storedCodes) }).where(eq(schema.users.id, user.id));
        }
      }

      if (!twoFaValid) {
        return reply.status(401).send({ error: "Invalid 2FA code" });
      }
    }

    // Update last login
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
    await storeRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        preferredLanguage: user.preferredLanguage,
        preferredNetwork: user.preferredNetwork,
      },
      accessToken,
      refreshToken,
    };
  });

  // ──────────────────────────────────────────
  // REFRESH TOKEN
  // ──────────────────────────────────────────
  app.post("/api/v1/auth/refresh", {
      schema: {
        description: "Exchange a refresh token for a new access/refresh token pair. Old refresh token is revoked.",
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string", description: "Current refresh token" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              refreshToken: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      return reply.status(400).send({ error: "Refresh token required" });
    }

    const valid = await validateStoredRefreshToken(refreshToken);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }

    try {
      const payload = verifyRefreshToken(refreshToken);

      // Revoke old token, issue new pair
      await revokeRefreshToken(refreshToken);

      const newAccessToken = generateAccessToken({ userId: payload.userId, email: payload.email });
      const newRefreshToken = generateRefreshToken({ userId: payload.userId, email: payload.email });
      await storeRefreshToken(payload.userId, newRefreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }
  });

  // ──────────────────────────────────────────
  // LOGOUT
  // ──────────────────────────────────────────
  app.post("/api/v1/auth/logout", {
      schema: {
        description: "Revoke a refresh token, ending the session.",
        tags: ["Auth"],
        body: {
          type: "object",
          properties: {
            refreshToken: { type: "string" },
          },
        },
        response: {
          200: { type: "object", properties: { ok: { type: "boolean" } } },
        },
      },
    }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    return { ok: true };
  });

  // ──────────────────────────────────────────
  // GET CURRENT USER (protected)
  // ──────────────────────────────────────────
  app.get("/api/v1/auth/me", {
      preHandler: authMiddleware,
      schema: {
        description: "Get current authenticated user profile with their wallets.",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "number" },
              email: { type: "string" },
              firstName: { type: "string", nullable: true },
              lastName: { type: "string", nullable: true },
              avatar: { type: "string", nullable: true },
              preferredLanguage: { type: "string" },
              preferredNetwork: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
              wallets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
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
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const userId = request.user!.userId;

    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        avatar: schema.users.avatar,
        preferredLanguage: schema.users.preferredLanguage,
        preferredNetwork: schema.users.preferredNetwork,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    // Get user's wallets
    const wallets = await db
      .select({
        id: schema.userWallets.id,
        name: schema.userWallets.name,
        publicKey: schema.userWallets.publicKey,
        network: schema.userWallets.network,
        isActive: schema.userWallets.isActive,
        createdAt: schema.userWallets.createdAt,
      })
      .from(schema.userWallets)
      .where(eq(schema.userWallets.userId, userId));

    return { ...user, wallets };
  });

  // ──────────────────────────────────────────
  // UPDATE PROFILE (protected)
  // ──────────────────────────────────────────
  app.patch("/api/v1/auth/profile", {
      preHandler: authMiddleware,
      schema: {
        description: "Update user profile fields (first name, last name, avatar, language, network).",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            avatar: { type: "string" },
            preferredLanguage: { type: "string", enum: ["en", "fr", "es", "pt", "zh"] },
            preferredNetwork: { type: "string", enum: ["testnet", "mainnet"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "number" },
              email: { type: "string" },
              firstName: { type: "string", nullable: true },
              lastName: { type: "string", nullable: true },
              avatar: { type: "string", nullable: true },
              preferredLanguage: { type: "string" },
              preferredNetwork: { type: "string" },
            },
          },
        },
      },
    }, async (request) => {
    const userId = request.user!.userId;
    const { firstName, lastName, avatar, preferredLanguage, preferredNetwork } = request.body as any;

    const updates: any = { updatedAt: new Date() };
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (avatar !== undefined) updates.avatar = avatar;
    if (preferredLanguage !== undefined) updates.preferredLanguage = preferredLanguage;
    if (preferredNetwork !== undefined) updates.preferredNetwork = preferredNetwork;

    const [updated] = await db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        avatar: schema.users.avatar,
        preferredLanguage: schema.users.preferredLanguage,
        preferredNetwork: schema.users.preferredNetwork,
      });

    return updated;
  });

  // ──────────────────────────────────────────
  // CHANGE PASSWORD (protected)
  // ──────────────────────────────────────────
  app.post("/api/v1/auth/change-password", {
      preHandler: authMiddleware,
      schema: {
        description: "Change user password. Revokes all refresh tokens, forcing re-login on all devices.",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8 },
          },
        },
        response: {
          200: { type: "object", properties: { ok: { type: "boolean" } } },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
    const userId = request.user!.userId;
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return reply.status(400).send({ error: "Invalid passwords" });
    }

    const [user] = await db
      .select({ passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Current password is incorrect" });
    }

    const newHash = await hashPassword(newPassword);
    await db.update(schema.users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(schema.users.id, userId));

    // Revoke all refresh tokens (force re-login everywhere)
    await revokeAllUserTokens(userId);

    return { ok: true };
  });


    // ──────────────────────────────────────────
    // VERIFY EMAIL
    // ──────────────────────────────────────────
    app.get("/api/v1/auth/verify-email", {
      schema: {
        description: "Verify email address using token from verification email.",
        tags: ["Auth"],
        querystring: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string", description: "64-char hex verification token" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" } } },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
      const { token } = request.query as { token: string };

      if (!token) {
        return reply.status(400).send({ error: "Token is required" });
      }

      try {
        const result = await db.execute(
          sql`SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token = ${token} LIMIT 1`
        );
        const record = (result as any).rows?.[0] || (result as any)[0];

        if (!record) {
          return reply.status(400).send({ error: "Invalid verification token" });
        }

        if (record.used_at) {
          return { success: true, message: "Email already verified" };
        }

        if (new Date(record.expires_at) < new Date()) {
          return reply.status(400).send({ error: "Verification token has expired. Please request a new one." });
        }

        // Mark email as verified
        await db.update(schema.users)
          .set({ isEmailVerified: true })
          .where(eq(schema.users.id, record.user_id));

        // Mark token as used
        await db.execute(
          sql`UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ${record.id}`
        );

        return { success: true, message: "Email verified successfully!" };
      } catch (err: any) {
        console.error("[verify-email] Error:", err.message);
        return reply.status(500).send({ error: "Verification failed" });
      }
    });

    // ──────────────────────────────────────────
    // RESEND VERIFICATION EMAIL
    // ──────────────────────────────────────────
    app.post("/api/v1/auth/resend-verification", {
      preHandler: authMiddleware,
      schema: {
        description: "Resend email verification link to the authenticated user.",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" } } },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    }, async (request, reply) => {
      const userId = request.user!.userId;

      const [user] = await db
        .select({ email: schema.users.email, isEmailVerified: schema.users.isEmailVerified })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      if (user.isEmailVerified) {
        return { success: true, message: "Email is already verified" };
      }

      try {
        const verifyToken = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.execute(
          sql`INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (${userId}, ${verifyToken}, ${expiresAt})`
        );
        await sendVerificationEmail(user.email, verifyToken);
        return { success: true, message: "Verification email sent" };
      } catch (err: any) {
        console.error("[resend-verification] Error:", err.message);
        return reply.status(500).send({ error: "Failed to send verification email" });
      }
    });

}
