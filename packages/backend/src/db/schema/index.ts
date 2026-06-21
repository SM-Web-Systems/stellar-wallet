import {
  pgTable,
  bigserial,
  text, 
  numeric,
  integer,
  smallint,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  bigint,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ════════════════════════════════════════════
// Tokens — The master token registry
// ════════════════════════════════════════════

export const tokens = pgTable(
  "tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    assetType: text("asset_type").notNull(),
    assetCode: text("asset_code"),
    assetIssuer: text("asset_issuer"),
    homeDomain: text("home_domain"),

    tomlName: text("toml_name"),
    tomlOrg: text("toml_org"),
    tomlImage: text("toml_image"),
    tomlDesc: text("toml_desc"),
    tomlStatus: text("toml_status"),
    anchorAsset: text("anchor_asset"),
    anchorType: text("anchor_type"),

    totalSupply: numeric("total_supply"),
    trustlineCount: integer("trustline_count").default(0),
    fundedTrustlines: integer("funded_trustlines").default(0),
    paymentCount: bigint("payment_count", { mode: "number" }).default(0),
    tradeCount: bigint("trade_count", { mode: "number" }).default(0),
    volume7d: numeric("volume_7d").default("0"),

    ratingAge: smallint("rating_age").default(0),
    ratingTrades: smallint("rating_trades").default(0),
    ratingPayments: smallint("rating_payments").default(0),
    ratingTrustlines: smallint("rating_trustlines").default(0),
    ratingVolume: smallint("rating_volume").default(0),
    ratingLiquidity: smallint("rating_liquidity").default(0),
    ratingInterop: smallint("rating_interop").default(0),
    ratingAverage: numeric("rating_average", { precision: 3, scale: 1 }).default("0"),

    isVerified: boolean("is_verified").default(false),
    isSpam: boolean("is_spam").default(false),
    isFeatured: boolean("is_featured").default(false),

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    localIcon: text('local_icon'),
  },
  (table) => [
    uniqueIndex("idx_tokens_code_issuer").on(table.assetCode, table.assetIssuer),
    index("idx_tokens_code").on(table.assetCode),
    index("idx_tokens_issuer").on(table.assetIssuer),
    index("idx_tokens_rating").on(table.ratingAverage),
    index("idx_tokens_domain").on(table.homeDomain),
  ]
);

// ════════════════════════════════════════════
// Contract Tokens — Soroban SEP-41 + SAC
// ════════════════════════════════════════════

export const contractTokens = pgTable("contract_tokens", {
  id: text("id").primaryKey(),
  contractType: text("contract_type").notNull(),
  assetCode: text("asset_code"),
  assetIssuer: text("asset_issuer"),
  name: text("name"),
  symbol: text("symbol"),
  decimals: smallint("decimals").notNull().default(7),
  tokenId: bigint("token_id", { mode: "number" }).references(() => tokens.id),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ════════════════════════════════════════════
// User Tokens — Per-user token preferences
// ════════════════════════════════════════════

export const userTokens = pgTable(
  "user_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicKey: text("public_key").notNull(),
    tokenId: bigint("token_id", { mode: "number" }).references(() => tokens.id),
    contractId: text("contract_id").references(() => contractTokens.id),
    isFavorite: boolean("is_favorite").default(false),
    isHidden: boolean("is_hidden").default(false),
    displayOrder: integer("display_order").default(0),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_user_tokens_pubkey_token").on(table.publicKey, table.tokenId),
    index("idx_user_tokens_pubkey").on(table.publicKey),
  ]
);

// ════════════════════════════════════════════
// Transaction History Cache
// ════════════════════════════════════════════

export const txHistory = pgTable(
  "tx_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicKey: text("public_key").notNull(),
    txHash: text("tx_hash").notNull().unique(),
    ledgerNumber: bigint("ledger_number", { mode: "number" }),
    operationType: text("operation_type").notNull(),
    assetCode: text("asset_code"),
    assetIssuer: text("asset_issuer"),
    amount: numeric("amount"),
    fromAddress: text("from_address"),
    toAddress: text("to_address"),
    memo: text("memo"),
    memoType: text("memo_type"),
    feeCharged: bigint("fee_charged", { mode: "number" }),
    successful: boolean("successful").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_tx_history_pubkey").on(table.publicKey, table.createdAt),
    index("idx_tx_history_hash").on(table.txHash),
  ]
);

// ════════════════════════════════════════════
// Liquidity Pools
// ════════════════════════════════════════════

export const liquidityPools = pgTable(
  "liquidity_pools",
  {
    poolId: text("pool_id").primaryKey(),
    assetACode: text("asset_a_code").notNull(),
    assetAIssuer: text("asset_a_issuer"),
    assetBCode: text("asset_b_code").notNull(),
    assetBIssuer: text("asset_b_issuer"),
    feeBp: integer("fee_bp").default(30),
    reserveA: numeric("reserve_a"),
    reserveB: numeric("reserve_b"),
    totalShares: numeric("total_shares"),
    totalTrustlines: integer("total_trustlines"),
    spotPrice: numeric("spot_price"),
    volume24h: numeric("volume_24h").default("0"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_lp_assets").on(table.assetACode, table.assetBCode),
  ]
);

// ════════════════════════════════════════════
// Sync State
// ════════════════════════════════════════════

export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ════════════════════════════════════════════
// Users — Authentication & Profile
// ════════════════════════════════════════════

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    avatar: text("avatar"),
    preferredLanguage: text("preferred_language").default("en"),
    preferredNetwork: text("preferred_network").default("testnet"),
    isEmailVerified: boolean("is_email_verified").default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    signingMode: text("signing_mode").default("delegated"), // 'self' | 'delegated'
    twoFaSecret: text("two_fa_secret"),
    twoFaEnabled: boolean("two_fa_enabled").default(false),
    twoFaMethod: text("two_fa_method").default("none"), // 'none' | 'totp'
    twoFaBackupCodes: text("two_fa_backup_codes"),
    twoFaStaticCode: text("two_fa_static_code"), // hashed user-chosen 6-digit code // JSON array of hashed codes
  },
  (table) => [
    uniqueIndex("idx_users_email").on(table.email),
  ]
);

// ════════════════════════════════════════════
// User Wallets — Linked Amma wallets
// ════════════════════════════════════════════

export const userWallets = pgTable(
  "user_wallets",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    publicKey: text("public_key").notNull(),
    encryptedSecret: text("encrypted_secret"),
    network: text("network").notNull().default("testnet"),
    isActive: boolean("is_active").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_user_wallets_user_pubkey").on(table.userId, table.publicKey),
    index("idx_user_wallets_user").on(table.userId),
  ]
);

// ════════════════════════════════════════════
// Refresh Tokens — For JWT rotation
// ════════════════════════════════════════════

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_refresh_tokens_user").on(table.userId),
    index("idx_refresh_tokens_token").on(table.token),
  ]
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ════════════════════════════════════════════
// ALL Relations (must come after ALL tables)
// ════════════════════════════════════════════


// ════════════════════════════════════════════
// Email Codes — 2FA and verification codes
// ════════════════════════════════════════════
export const emailCodes = pgTable(
  "email_codes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    type: text("type").notNull().default("login"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    used: boolean("used").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_email_codes_user").on(table.userId),
  ]
);

export const tokensRelations = relations(tokens, ({ many }) => ({
  contractTokens: many(contractTokens),
  userTokens: many(userTokens),
}));

export const contractTokensRelations = relations(contractTokens, ({ one }) => ({
  token: one(tokens, {
    fields: [contractTokens.tokenId],
    references: [tokens.id],
  }),
}));

export const userTokensRelations = relations(userTokens, ({ one }) => ({
  token: one(tokens, {
    fields: [userTokens.tokenId],
    references: [tokens.id],
  }),
  contract: one(contractTokens, {
    fields: [userTokens.contractId],
    references: [contractTokens.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(userWallets),
  refreshTokens: many(refreshTokens),
}));

export const userWalletsRelations = relations(userWallets, ({ one }) => ({
  user: one(users, {
    fields: [userWallets.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// ════════════════════════════════════════════
// API Keys — For public API access
// ════════════════════════════════════════════

export const apiKeys = pgTable(
  "api_keys",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    isActive: boolean("is_active").default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_api_keys_key").on(table.key),
    index("idx_api_keys_user").on(table.userId),
  ]
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));
