# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### EcoWatt Energy Explorer (`artifacts/ecowatt`)
- **Kind**: React + Vite web app
- **Port**: 26090 · **Preview**: `/`
- **Stack**: wagmi v3, viem v2, Recharts, Tailwind CSS v4, wouter, localStorage state
- **Pages**: Dashboard, Marketplace, Trading, Tokens, Portfolio, Blockchain Explorer, Transactions, Analytics
- **Key contracts**: ECOW Token `0x7f268357A8c2552623316e2562D90e642BB538E5`, Marketplace `0x3f9065F048625E57E2e2e0a8C20f2A8b4B0e4d2`
- **Blockchain Explorer features**: Live block feed, Energy Consumption Heatmap (hourly/weekly), Renewable Energy % gauge, Carbon emission tracking per block, 24h Gas Price Forecast chart, MEV & Block Reward distribution, Validator energy efficiency table, ECOW Token Flow timeline
- **State**: All data stored in `localStorage` with key `ecowatt_data_v3` — no backend DB needed
- **Alchemy API**: `VITE_ALCHEMY_API_KEY` env var (falls back to hardcoded dev key)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
