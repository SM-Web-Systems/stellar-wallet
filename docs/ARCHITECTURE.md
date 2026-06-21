# Architecture

## System Overview

```mermaid
graph LR
    A[Browser - React SPA] --> B[Cloudflare CDN]
    B --> C[Nginx - SSL port 443]
    C --> D[Fastify API - port 3001]
    D --> E[PostgreSQL - port 5432]
    D --> F[Stellar Horizon]
    D --> G[StellarExpert API]
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant DB as PostgreSQL

    U->>F: Enter email + password
    F->>A: POST /auth/login + Turnstile token
    A->>A: Verify Turnstile
    A->>DB: Lookup user, verify bcrypt hash
    alt 2FA Enabled
        A->>F: twoFaRequired: true
        U->>F: Enter 2FA code
        F->>A: POST /auth/login + twoFaToken
        A->>DB: Verify 2FA code
    end
    A->>DB: Store refresh token
    A->>F: accessToken + refreshToken
    F->>F: Store in Zustand + localStorage
```

## Transaction Flow (Delegated Mode)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant H as Horizon

    U->>F: Initiate send/swap
    F->>F: Build transaction XDR
    F->>A: POST /transactions/sign-and-submit + PIN
    A->>A: Verify JWT, load active wallet
    A->>A: Decrypt secret with PIN
    alt Swap Operation
        A->>A: Inject platform fee operation
    end
    A->>A: Sign transaction
    A->>A: Wrap in fee bump (optional)
    A->>H: Submit transaction
    H->>A: Transaction result
    A->>F: success + result
```

## Transaction Flow (Self-Custody Mode)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant H as Horizon

    U->>F: Initiate send/swap
    F->>A: Build transaction (swap/quote)
    A->>F: Unsigned XDR
    F->>F: Sign locally with secret key
    F->>A: POST /transactions/submit (signed XDR)
    A->>H: Submit transaction
    H->>A: Transaction result
    A->>F: success + result
```

## Token Enrichment Pipeline

```mermaid
graph TD
    A[Server Startup] --> B[Horizon Discovery]
    B --> C[Fetch 200 latest assets]
    C --> D[StellarExpert Enrichment]
    D --> E[Fetch ratings, trustlines, domains - 500 per run]
    E --> F[TOML Image Sync]
    F --> G[Resolve icons from issuer TOML files]
    G --> H[Icon Resolver]
    H --> I[Download and cache from CryptoLogos/CMC]
    I --> J[Database Updated]
```

## Database Schema

```mermaid
erDiagram
    users ||--o{ user_wallets : has
    users ||--o{ refresh_tokens : has
    users ||--o{ email_verification_tokens : has
    users ||--o{ password_reset_tokens : has
    users ||--o{ email_codes : has
    users ||--o{ api_keys : has

    users {
        bigint id PK
        text email
        text password_hash
        text first_name
        text last_name
        boolean is_email_verified
        text signing_mode
        text preferred_network
    }

    user_wallets {
        bigint id PK
        bigint user_id FK
        text public_key
        text name
        boolean is_active
        text encrypted_secret
    }

    tokens {
        bigint id PK
        text asset_code
        text asset_issuer
        text asset_type
        text toml_name
        text home_domain
        text rating_average
        integer trustline_count
        text volume_7d
        boolean is_verified
    }
```

## Security Architecture

Authentication:
- Passwords hashed with bcrypt (12 rounds)
- JWT access tokens: 15-minute expiry, signed with HS256
- JWT refresh tokens: 7-day expiry, stored in DB, single-use rotation
- Logout revokes refresh token; password change revokes all tokens

2FA Methods:
- TOTP -- standard authenticator app (Google Authenticator, Authy)
- Email -- 6-digit code sent via SMTP, 10-minute expiry
- Static Code -- pre-shared code hashed with SHA-256
- Backup Codes -- 10 one-time codes, hashed, removed after use

Wallet Security (Delegated Mode):
- Wallet secret encrypted with user PIN before storage
- PIN never stored; used only at signing time to decrypt
- Decryption failure returns 403 (invalid PIN)
- Secret key material held in memory only during signing operation

Rate Limiting:
- Global: 100 requests per minute per IP
- Auth endpoints: 10 per 5 minutes
- Based on X-Forwarded-For header (behind Nginx/Cloudflare)

## Frontend Architecture

Code Splitting: All page components lazy-loaded via React.lazy(). Vendor chunks split for stellar SDK (256KB gz), react (67KB gz), icons, query, i18n, polyfills. Initial load approximately 170KB gzipped.

State Management: Zustand for auth and wallet state. React Query for server state (tokens, balances, history).

Routing: React Router v7 with layout components. Protected routes require authentication.
