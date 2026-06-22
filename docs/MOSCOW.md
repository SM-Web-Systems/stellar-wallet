# MoSCoW Feature Prioritization

## Must Have (v1.0) — Complete

| Feature | Status | Notes |
|---------|--------|-------|
| User registration and login | Done | Email/password with Cloudflare Turnstile |
| Email verification | Done | Token-based, required before full access |
| JWT authentication | Done | 15-min access, 7-day refresh, rotation with revocation |
| Multi-wallet management | Done | Create, import, rename, delete, switch active wallet |
| HD wallet creation | Done | BIP-39 mnemonic, 12 or 24 words |
| Import wallet via secret key | Done | Optional server-side encryption with PIN |
| Send XLM and tokens | Done | With memo support (text, id, hash) |
| Receive with QR code | Done | QR code generation plus copyable address |
| Token discovery and search | Done | 340+ tokens, server-side pagination (50/page), sortable columns |
| Trustline management | Done | Add, remove, and update trust limits |
| Swap via Stellar DEX | Done | Path payment with best-route, price impact display |
| Transaction history | Done | Paginated from Horizon with cursor-based navigation |
| Self-custody signing | Done | Client-side signing, keys never leave the browser |
| Delegated signing | Done | PIN-encrypted server-side signing with optional fee-bump |
| Two-factor authentication | Done | TOTP, email codes, and static backup codes |
| Password reset | Done | Email token with 1-hour expiry |
| API documentation | Done | Swagger/OpenAPI for all 54 endpoints |
| Rate limiting | Done | 100/min global, 10/5min on auth endpoints |
| Platform fee on swaps | Done | Configurable percentage, works in both signing modes |
| HTTPS/SSL | Done | Let's Encrypt via Nginx with auto-renewal |

## Should Have (v1.1) — Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Dark and light theme | Done | CSS custom properties with instant toggle |
| Mobile responsive design | Done | Hamburger menu, slide-out drawer, sticky header |
| Multi-language support | Done | 18 languages including RTL (Arabic) |
| Address book / contacts | Done | Per-user CRUD with memo and notes, isolated per account |
| In-app notifications | Done | Bell icon, persistent store, mark-read, clear-all |
| Price charts | Done | OHLCV from Horizon trade aggregations, 1W/1M/3M/1Y |
| Orderbook depth chart | Done | Visual bid/ask depth via Recharts |
| Token enrichment pipeline | Done | StellarExpert integration, network-aware, XLM support |
| Bundle optimization | Done | Code splitting, vendor chunks, 170 KB gzipped initial load |
| npm audit remediation | Done | Backend 4 moderate (dev-only), frontend 6 low |
| In-app help and FAQ | Done | 19 FAQ items across 6 categories at /help |
| Auto-liquifier | Done | Converts non-XLM fees to XLM every 6 hours |
| Admin endpoints | Done | Manual liquify and platform balance check |
| Toast standardization | Done | Migrated all to Sonner, removed react-hot-toast |

## Could Have (v1.2) — Planned

| Feature | Status | Notes |
|---------|--------|-------|
| Soroban smart contract interaction | Planned | Invoke contracts, deploy tokens |
| Multi-signature support | Planned | Orion Safe integration (SCF44) |
| Fiat on/off ramp | Planned | Third-party provider integration |
| Push notifications | Planned | Service worker, web push API |
| Portfolio analytics | Planned | Historical balance tracking, PnL |
| Export transaction history | Planned | CSV/PDF export for tax reporting |
| Custom token creation | Planned | Issue new assets via the UI |
| Staking and rewards | Planned | AMM liquidity provision tracking |

## Won't Have (out of scope)

| Feature | Reason |
|---------|--------|
| Full block explorer | Dedicated tools like StellarExpert exist |
| Custodial exchange | Regulatory complexity, out of scope |
| Non-Stellar chains | Amma Wallet is Stellar-focused |
| Native mobile apps | Web-first approach, PWA possible later |

---

## Future (v2.0) — Planned

| Feature | Description | Complexity |
|---------|-------------|------------|
| SEP-24 Anchor Platform | Become a licensed Stellar anchor, handle KYC/AML, connect to local payment rails (M-Pesa, bank transfers) | Very High |
| Custom fiat corridors | Direct ZAR, NGN, KES on/off ramp without third-party dependency | High |
| Multi-chain bridge | Bridge USDC between Stellar and other chains (Ethereum, Solana) via Wormhole/Allbridge | High |
| Soroban smart contracts | Deploy and interact with Soroban smart contracts on Stellar | High |
| Multi-signature wallets | Require multiple signers for transaction approval | Medium |
| Native mobile apps | React Native iOS/Android apps with biometric auth | High |
| Hardware wallet support | Ledger/Trezor integration for cold storage signing | Medium |
| Recurring payments | Scheduled automated payments and subscriptions | Medium |
| DAO governance | Community voting on platform decisions using governance tokens | High |
