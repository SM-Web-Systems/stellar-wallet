# API Reference

**Base URL:** https://ammawallet.com
**Interactive Docs:** [https://ammawallet.com/docs](https://ammawallet.com/docs)

The backend exposes 54 REST API endpoints organized into 12 categories. All endpoints return JSON. Protected endpoints require a JWT bearer token in the Authorization header.

## Authentication

Obtain tokens by posting credentials to the login endpoint. The response includes an access token (15-minute expiry) and a refresh token (7-day expiry). Include the access token in subsequent requests as Authorization: Bearer <token>. When the access token expires, use the refresh endpoint to obtain a new pair. API keys can also be used via the x-api-key header for programmatic access.

## Endpoints

### Auth

POST /api/v1/auth/register creates a new account with email, password, first name, and last name. A verification email is sent automatically. POST /api/v1/auth/login authenticates with email and password. If 2FA is enabled, the response includes requiresTwoFactor: true and a tempToken; resubmit with the twoFactorCode field to complete login. POST /api/v1/auth/refresh exchanges a valid refresh token for a new access/refresh token pair. POST /api/v1/auth/logout revokes the current refresh token. GET /api/v1/auth/me returns the authenticated user's profile including wallets. PATCH /api/v1/auth/profile updates profile fields such as name, avatar URL, preferred language, and preferred network.

### Wallets

POST /api/v1/wallets creates a new wallet (HD mnemonic or imported secret key). GET /api/v1/wallets lists all wallets for the authenticated user. PATCH /api/v1/wallets/:id updates a wallet's name or active status. DELETE /api/v1/wallets/:id removes a wallet. POST /api/v1/wallets/:id/activate sets a wallet as the active wallet.

### Tokens

GET /api/v1/tokens lists tokens with pagination and sorting. Query parameters include query (search term), sortBy (rating, volume, trustlines, name), limit (default 50), offset (default 0), and verified (boolean filter). The response includes a tokens array and a pagination object with total, limit, offset, and hasMore. GET /api/v1/tokens/:code/:issuer returns full detail for a single token including ratings, orderbook, and liquidity pools. Use "native" as the issuer for XLM. GET /api/v1/tokens/:code/:issuer/price-history returns OHLCV candle data from Horizon trade aggregations. Query parameters include resolution (3600000 for 1h, 86400000 for 1d, 604800000 for 1w), limit (default 30, max 200), counterCode (default USDC), and counterIssuer. GET /api/v1/tokens/featured returns featured/promoted tokens. GET /api/v1/tokens/user/:publicKey returns token balances with metadata for a specific wallet. POST /api/v1/tokens/favorite toggles a token as favorite for a wallet. GET /api/v1/tokens/search-assets searches tokens across multiple sources. GET /api/v1/tokens/directory proxies the StellarExpert asset directory with pagination.

### Trustlines

POST /api/v1/trustlines/add builds a transaction to add a trustline. POST /api/v1/trustlines/remove builds a transaction to remove a trustline.

### Swap

POST /api/v1/swap/quote returns swap quotes with path-finding, exchange rate, price impact, and estimated fees. POST /api/v1/swap/execute executes a swap transaction (delegated mode with PIN or pre-signed XDR).

### Transactions

POST /api/v1/transactions/sign-and-submit signs a transaction XDR server-side using the PIN-decrypted wallet secret and submits to Horizon (delegated mode only). POST /api/v1/transactions/submit submits a pre-signed transaction XDR to Horizon (self-custody mode). GET /api/v1/transactions/:publicKey returns paginated transaction history from Horizon.

### Contacts

GET /api/v1/contacts lists all contacts in the authenticated user's address book. POST /api/v1/contacts adds a new contact with name, address, optional memo, memo type, and notes. PATCH /api/v1/contacts/:id updates an existing contact. DELETE /api/v1/contacts/:id removes a contact.

### Two-Factor Authentication

POST /api/v1/2fa/setup initiates 2FA setup and returns a TOTP secret and QR code URI. POST /api/v1/2fa/verify confirms 2FA setup with a valid code. POST /api/v1/2fa/disable disables 2FA after code verification. POST /api/v1/2fa/send-code sends a 2FA email code for email-based verification. GET /api/v1/2fa/backup-codes retrieves backup codes (generated during setup).

### API Keys

POST /api/v1/api-keys creates a new API key with optional expiry. GET /api/v1/api-keys lists all API keys for the user. DELETE /api/v1/api-keys/:id revokes an API key.

### Keypair Utilities

POST /api/v1/keypair/generate generates a new Stellar keypair. POST /api/v1/keypair/from-mnemonic derives a keypair from a BIP-39 mnemonic phrase.

### Signing Mode

POST /api/v1/signing-mode/switch switches between self-custody and delegated signing mode.

### Admin

POST /api/v1/admin/liquify triggers manual conversion of non-XLM platform fees to XLM. GET /api/v1/admin/platform-balance returns the platform wallet's current balances.

### Other

GET /health returns server status, network, and timestamp. GET /docs serves the Swagger UI. GET /docs/json returns the raw OpenAPI 3.0 specification.

## Rate Limits

All endpoints are subject to a global rate limit of 100 requests per minute per IP. Authentication endpoints (login, register, forgot-password, reset-password, change-password) have a stricter limit of 10 requests per 5 minutes. Rate limit headers are included in every response: x-ratelimit-limit, x-ratelimit-remaining, and x-ratelimit-reset.

## Error Format

All errors return a JSON object with an error field containing a human-readable message. HTTP status codes follow standard conventions: 400 for validation errors, 401 for missing or invalid authentication, 403 for forbidden actions or invalid PIN, 404 for not found, 409 for conflicts (e.g., duplicate email), 429 for rate limit exceeded, and 500 for internal server errors.

## Example: Login Flow

Send a POST request to /api/v1/auth/login with a JSON body containing email, password, and turnstileToken fields. On success without 2FA, the response includes accessToken, refreshToken, and user object. If 2FA is enabled, the first response returns requiresTwoFactor: true with tempToken and methods array. Send a second POST to the same endpoint with email, password, twoFactorCode, twoFactorMethod, and tempToken to complete authentication.

## Example: Token List with Pagination

Send a GET request to /api/v1/tokens?sortBy=rating&limit=10&offset=0. The response includes a tokens array of token objects and a pagination object with total (e.g., 342), limit (10), offset (0), and hasMore (true).
