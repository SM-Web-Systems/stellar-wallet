# API Reference

Base URL: https://ammawallet.com
Interactive Docs: https://ammawallet.com/docs

## Authentication

All authenticated endpoints require a JWT bearer token in the Authorization header:
Authorization: Bearer <access_token>

Obtain tokens via POST /api/v1/auth/login. Access tokens expire after 15 minutes.
Use POST /api/v1/auth/refresh to get new tokens.

Alternatively, use an API key in the x-api-key header for programmatic access.

---

## Endpoints Summary

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Register new account |
| POST | /api/v1/auth/login | Login (supports 2FA challenge) |
| POST | /api/v1/auth/refresh | Refresh JWT tokens |
| POST | /api/v1/auth/logout | Revoke refresh token |
| GET | /api/v1/auth/me | Get current user profile + wallets |
| PATCH | /api/v1/auth/profile | Update profile (name, avatar, language, network) |
| POST | /api/v1/auth/change-password | Change password, revokes all sessions |
| POST | /api/v1/auth/forgot-password | Request password reset email |
| POST | /api/v1/auth/reset-password | Reset password with token |

### Wallets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/wallets | List user wallets |
| POST | /api/v1/wallets | Add a wallet |
| PATCH | /api/v1/wallets/:id/activate | Set wallet as active |
| PATCH | /api/v1/wallets/:id/rename | Rename a wallet |
| DELETE | /api/v1/wallets/:id | Remove a wallet |

### Tokens

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/tokens | List tokens (paginated, sortable) |
| GET | /api/v1/tokens/featured | Featured/verified tokens |
| GET | /api/v1/tokens/directory | StellarExpert directory proxy |
| GET | /api/v1/tokens/:code/:issuer | Token detail |
| GET | /api/v1/tokens/user/:publicKey | Tokens held by a public key |
| POST | /api/v1/tokens/favorite | Toggle token favorite |
| GET | /api/v1/tokens/search-assets | Multi-source asset search |

### Trustlines

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/trustlines/:publicKey | List trustlines for account |
| POST | /api/v1/trustlines/add | Build add-trustline transaction |
| POST | /api/v1/trustlines/remove | Build remove-trustline transaction |
| POST | /api/v1/trustlines/update-limit | Update trustline limit |
| GET | /api/v1/trustlines/check/:pk/:code/:issuer | Check if trustline exists |

### Swap

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/swap/quote | Get swap quote via DEX path finding |
| POST | /api/v1/swap/build | Build swap transaction XDR |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/transactions/submit | Submit pre-signed XDR |
| POST | /api/v1/transactions/sign | Sign XDR server-side (delegated) |
| POST | /api/v1/transactions/sign-and-submit | Sign + submit (delegated, with PIN) |
| GET | /api/v1/transactions/history/:publicKey | Transaction history from Horizon |

### Signing Mode

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/user/signing-mode | Get current signing mode |
| PATCH | /api/v1/user/signing-mode | Switch between self and delegated |

### Two-Factor Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/2fa/status | Check 2FA status and enabled methods |
| POST | /api/v1/2fa/setup/:method | Setup 2FA (totp, email, or static) |
| POST | /api/v1/2fa/verify | Verify a 2FA code |
| POST | /api/v1/2fa/disable | Disable 2FA |
| POST | /api/v1/2fa/backup-codes | Generate backup codes |
| POST | /api/v1/2fa/send-email-code | Send a 2FA email code |

### Keypair Utilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/keypair/generate | Generate random Stellar keypair |
| POST | /api/v1/keypair/from-secret | Derive public key from secret |
| POST | /api/v1/keypair/validate-mnemonic | Validate a BIP39 mnemonic |
| POST | /api/v1/keypair/from-mnemonic | Derive keypair from mnemonic |

### API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/api-keys | Create an API key |
| GET | /api/v1/api-keys | List user API keys |
| DELETE | /api/v1/api-keys/:id | Revoke an API key |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/admin/liquify | Trigger manual fee conversion to XLM |
| GET | /api/v1/admin/platform-balance | View platform wallet balances |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Server health check |
| GET | /api/v1/wallet/account/:publicKey | Stellar account info |
| POST | /api/v1/wallet/fund | Fund account via friendbot (testnet) |

---

## Request/Response Examples

### Register
POST /api/v1/auth/register
Body: { "email": "user@example.com", "password": "securepass", "firstName": "John", "lastName": "Doe" }
Response 201: { "user": { "id": 1, "email": "...", "isEmailVerified": false }, "accessToken": "eyJ...", "refreshToken": "eyJ..." }

### Login (no 2FA)
POST /api/v1/auth/login
Body: { "email": "user@example.com", "password": "securepass" }
Response 200: { "user": { "id": 1, "signingMode": "delegated" }, "accessToken": "eyJ...", "refreshToken": "eyJ..." }

### Login (2FA required)
Response 200: { "twoFaRequired": true, "methods": ["totp", "email"], "userId": 1 }
Then re-call with twoFaToken field to complete login.

### List Tokens (paginated)
GET /api/v1/tokens?sortBy=rating&limit=50&offset=0&query=usdc&verified=true
Response 200: { "tokens": [...], "pagination": { "total": 342, "limit": 50, "offset": 0, "hasMore": true } }

### Sign and Submit (delegated)
POST /api/v1/transactions/sign-and-submit
Body: { "xdr": "AAAA...", "pin": "1234" }
Response 200: { "success": true, "result": {...}, "fee": "0.0001", "feeBumped": true }

---

## Rate Limits

| Scope | Limit | Window |
|-------|-------|--------|
| Global (all endpoints) | 100 requests | 1 minute |
| Auth endpoints | 10 requests | 5 minutes |

Headers returned: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

429 response: { "statusCode": 429, "error": "Too Many Requests", "message": "Rate limit exceeded." }

---

## Error Format

All errors follow: { "statusCode": 400, "error": "Bad Request", "message": "Description" }

Common codes: 400 (invalid input), 401 (not authenticated), 403 (forbidden/invalid PIN), 404 (not found), 409 (conflict), 429 (rate limited), 500 (server error), 502 (upstream error)
