# Amma Wallet

A full-featured Stellar blockchain wallet with web interface, supporting both self-custody and delegated signing modes.

Live: https://ammawallet.com
API Docs: https://ammawallet.com/docs

---

## Overview

Amma Wallet provides a secure, user-friendly interface for interacting with the Stellar network. It supports multi-wallet management, token discovery, trustline management, swaps via the Stellar DEX, two-factor authentication, and both self-custody and server-side (delegated) transaction signing.

## Project Structure

The project is a monorepo with two packages:

- packages/backend -- Fastify REST API (Node.js + TypeScript)
  - src/config -- Environment configuration
  - src/db -- Drizzle ORM schema and migrations
  - src/jobs -- Token indexer, scheduled tasks
  - src/lib -- Utilities (email, encryption, icon resolver, liquifier)
  - src/middleware -- Auth middleware, Turnstile verification
  - src/modules -- Business logic (tokens, swap services)
  - src/routes -- Route handlers (auth, wallets, 2FA, trustlines, password-reset)
  - src/server.ts -- Main server entry point with all route definitions

- packages/web-app -- React SPA (Vite + TypeScript + Tailwind CSS)
  - src/components -- Reusable UI components
  - src/hooks -- Custom React hooks
  - src/lib -- API client, utilities
  - src/pages -- Page components (lazy-loaded)
  - src/store -- Zustand state management

- docs/ -- Project documentation

## Tech Stack

Backend: Node.js 20+, Fastify 5, TypeScript, PostgreSQL 16, Drizzle ORM, Stellar SDK, JWT auth, PM2
Frontend: React 19, Vite 6, Tailwind CSS 4, Zustand, TanStack React Query, i18next
Infrastructure: AWS EC2 (ARM64), Nginx, Lets Encrypt SSL, Cloudflare DNS

## Features

Wallet Management: Create and manage multiple Stellar wallets. HD wallet support (BIP39 mnemonic phrases). Import wallets via secret key or mnemonic. Switch between active wallets.

Signing Modes: Self-Custody mode signs transactions locally in the browser so keys never leave the device. Delegated mode signs transactions server-side with PIN-encrypted secrets, enabling advanced features like automatic fee handling.

Token and Asset Management: Browse 340+ tokens with server-side pagination (50 per page). Sort by trust score, name, volume, or holder count. Search tokens by code, name, or domain. Token metadata enriched from Stellar Expert (ratings, trustlines, trade counts). Add and remove trustlines from the token detail page. Favorite tokens for quick access.

Trading: Swap tokens via Stellar DEX path payments. Real-time quotes with best-path routing. Platform fee (configurable percentage) applied only on swap operations.

Security: Email verification on signup. Two-factor authentication (TOTP, email, static codes). Rate limiting (100 req/min global, 10/5min on auth endpoints). CORS protection with origin allowlist. Cloudflare Turnstile on login and register. JWT refresh token rotation with revocation. PIN-encrypted wallet secrets in delegated mode.

Platform Operations: Auto-liquifier converts non-XLM platform fees to XLM every 6 hours. Admin endpoints for manual liquification and balance monitoring. Token indexer syncs from Horizon and Stellar Expert on startup.

## Getting Started

Prerequisites: Node.js 20+, PostgreSQL 16+, npm 10+

Installation:
  1. Clone the repository
  2. cd packages/backend and run npm install
  3. cd packages/web-app and run npm install
  4. Copy .env.example to .env and configure (see docs/DEPLOYMENT.md)
  5. Run npx drizzle-kit push to set up the database
  6. Start backend: pm2 start "npx tsx src/server.ts" --name amma-backend
  7. Build frontend: cd packages/web-app and npm run build
  8. Serve dist/ folder via Nginx

## API Documentation

Interactive Swagger UI available at /docs when the backend is running.
Full reference: https://ammawallet.com/docs

Key endpoint categories: Auth, Wallets, Tokens, Trustlines, Swap, Transactions, 2FA, Admin

See docs/API.md for the full API reference.

## Documentation

- docs/ARCHITECTURE.md -- System architecture and data flow
- docs/MOSCOW.md -- Feature prioritization (MoSCoW method)
- docs/API.md -- Complete API reference
- docs/DEPLOYMENT.md -- Deployment and operations guide

## License

Proprietary -- SM Web Systems. All rights reserved.
