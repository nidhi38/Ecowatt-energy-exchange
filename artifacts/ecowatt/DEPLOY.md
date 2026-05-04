# EcoWatt Frontend — Deployment Guide

Run and deploy the EcoWatt React app on **any** platform without Replit.

---

## Requirements

- Node.js 18+ (or 20 LTS recommended)
- pnpm 9+ (`npm install -g pnpm`)

---

## Local Development

```bash
# From the repo root
pnpm install

# Start the dev server (defaults to port 3000)
cd artifacts/ecowatt
PORT=3000 BASE_PATH=/ pnpm dev

# Or without env vars — defaults are applied automatically
pnpm dev
```

Open `http://localhost:3000`.

---

## Production Build

```bash
cd artifacts/ecowatt
pnpm build
# Output is in artifacts/ecowatt/dist/public/
```

Serve the `dist/public/` folder with any static file host.

---

## Platform Deployment

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

cd artifacts/ecowatt
vercel
```

Or connect your GitHub repo in the Vercel dashboard and set:
- **Root directory:** `artifacts/ecowatt`
- **Build command:** `pnpm build`
- **Output directory:** `dist/public`

### Netlify

```bash
npm install -g netlify-cli
cd artifacts/ecowatt
netlify deploy --prod --dir dist/public
```

Or via the Netlify dashboard:
- **Base directory:** `artifacts/ecowatt`
- **Build command:** `pnpm build`
- **Publish directory:** `artifacts/ecowatt/dist/public`

### Cloudflare Pages

```bash
npm install -g wrangler
cd artifacts/ecowatt
pnpm build
wrangler pages deploy dist/public --project-name ecowatt
```

Dashboard settings:
- **Build command:** `pnpm --filter @workspace/ecowatt build`
- **Build output directory:** `artifacts/ecowatt/dist/public`

### GitHub Pages

```bash
cd artifacts/ecowatt
# Set BASE_PATH to your repo name if not deploying at root
BASE_PATH=/ecowatt pnpm build
# Then push dist/public to the gh-pages branch
```

Add to `vite.config.ts` or set `BASE_PATH` env var to your repo path.

### Docker (any VPS)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY . .
RUN pnpm install
RUN pnpm --filter @workspace/ecowatt build

FROM nginx:alpine
COPY --from=builder /app/artifacts/ecowatt/dist/public /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
docker build -t ecowatt .
docker run -p 8080:80 ecowatt
```

---

## Environment Variables

All env vars are optional — defaults work for local development:

| Variable    | Default | Description                       |
|-------------|---------|-----------------------------------|
| `PORT`      | `3000`  | Dev server port                   |
| `BASE_PATH` | `/`     | URL base path (for sub-path hosts)|

---

## Connecting to Real Smart Contracts

After deploying the contracts (see `contracts/README.md`), update the addresses in:

```
artifacts/ecowatt/src/lib/store.ts   (ECOW_CONTRACT, MARKETPLACE_CONTRACT, STAKING_POOL)
artifacts/ecowatt/src/lib/alchemy.ts (ALCHEMY_API_KEY)
```

Or create `artifacts/ecowatt/.env.local`:

```env
VITE_ECOW_TOKEN=0x...
VITE_MARKETPLACE=0x...
VITE_STAKING=0x...
VITE_ALCHEMY_KEY=your_key_here
```
