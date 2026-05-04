#!/bin/bash
npm install -g pnpm
cd ../..
pnpm install
pnpm -r --filter './artifacts/ecowatt' run build
