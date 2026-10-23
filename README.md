# CEVOC React prototype

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite.

## Build
```bash
npm run build
```
The deployable static build is written to `dist/`.

## Change workflow
Commit the clean baseline once. After edits use:
```bash
git status --short
git diff
git diff --name-only
```
To create a patch containing only tracked changes:
```bash
git diff > cevoc-changes.patch
```
