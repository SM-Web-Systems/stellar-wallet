# MoSCoW Feature Prioritization

## Must Have (v1.0 -- Complete)

| Feature | Status | Notes |
|---------|--------|-------|
| User registration and login | Done | Email/password with Turnstile |
| Email verification | Done | Token-based, 24h expiry |
| JWT authentication with refresh tokens | Done | 15min access, 7d refresh, rotation |
| Multi-wallet management | Done | Add, rename, delete, switch active |
| HD wallet creation (mnemonic) | Done | BIP39, 12/24 words |
| Import wallet via secret key | Done | With optional server-side encryption |
| Send XLM and tokens | Done | With memo support |
| Receive (QR code + address) | Done | Shareable QR with amount |
| Token discovery and search | Done | Paginated, sortable, multi-source |
| Trustline management | Done | Add/remove/update limit |
| Swap via Stellar DEX | Done | Path payment with best-route |
| Transaction history | Done | Paginated from Horizon |
| Self-custody signing | Done | Local signing, keys never leave browser |
| Delegated signing | Done | PIN-encrypted server-side signing |
| Two-factor authentication | Done | TOTP, email, static, backup codes |
| Password reset | Done | Email token, 1h expiry |
| API documentation (Swagger) | Done | 51 endpoints, OpenAPI 3.0.3 |
| Rate limiting | Done | Global + stricter on auth |
| Platform fee on swaps | Done | Configurable percent, both signing modes |
| HTTPS / SSL | Done | Lets Encrypt via Nginx |

## Should Have (v1.1 -- In Progress)

| Feature | Status | Notes |
|---------|--------|-------|
| Auto-liquifier for platform fees | Done | Converts non-XLM to XLM every 6h |
| Admin dashboard (web UI) | Planned | User management, platform stats, fee tracking |
| Mainnet deployment | Planned | Network switch, safety checks, production hardening |
| Push notifications | Planned | Payment received, swap completed |
| Token price charts | Planned | Historical price data from DEX trades |
| Contact/address book | Planned | Save frequently used addresses |
| Multi-language support | Planned | i18next infrastructure in place, translations needed |
| In-app help and FAQ | Planned | Guided onboarding, common questions |
| Custom SMTP (Stalwart) | Planned | Self-hosted mail for @ammawallet.com |
| SEO and landing page | Planned | Public marketing site |

## Could Have (v1.2)

| Feature | Status | Notes |
|---------|--------|-------|
| Soroban smart contract interaction | Planned | Invoke contracts, deploy tokens |
| NFT / collectible support | Planned | Stellar classic + Soroban NFTs |
| Fiat on-ramp integration | Planned | MoneyGram, Anchor integrations |
| Mobile app (React Native) | Planned | Share API client and business logic |
| WebAuthn / passkey login | Planned | FIDO2 passwordless authentication |
| Multi-sig wallet support | Planned | Threshold signing, co-signer management |
| CSV export for transactions | Planned | Tax reporting, accounting |
| Webhook notifications | Planned | API consumers get real-time events |
| Dark/light theme toggle | Planned | Currently dark only |

## Wont Have (this version)

| Feature | Reason |
|---------|--------|
| Custodial staking | Regulatory complexity |
| Built-in exchange (order book) | Use Stellar DEX directly |
| Cross-chain bridges | Out of scope for Stellar-focused wallet |
| Hardware wallet integration | Requires browser extension or USB API |
| Social login (Google/Apple) | Security concerns for financial app |
