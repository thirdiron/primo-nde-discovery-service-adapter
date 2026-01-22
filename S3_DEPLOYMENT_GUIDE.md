# S3 deployment (current process)

This repo deploys its built static assets to AWS S3 via CircleCI. Deployments are implemented in `.circleci/config.yml`.

## What gets deployed

- **Build output**: `dist/THIRD-IRON-LIBKEY`
- **Dev-test destination (feature branches)**: `s3://$AWS_BUCKET/primo-nde/dev-test`
- **Staging destination**: `s3://$AWS_BUCKET/primo-nde/staging`
- **Production destination**: `s3://$AWS_BUCKET/primo-nde/production`

## When deployments happen

- **`feature/*` branches** (CircleCI filter: `/feature\/.*/`): runs `deploy-to-dev-test`
- **`develop` branch**: runs `deploy-to-staging`
- **`main` branch**: runs `deploy-to-production`

Both jobs run only after `build-and-test` succeeds.

## Required CircleCI environment variables

Set these in CircleCI Project Settings → Environment Variables:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_DEFAULT_REGION`
- `AWS_BUCKET` (the bucket name)

## The deployment steps (CircleCI)

CircleCI does:

1. Install dependencies (`npm ci`)
2. Build (`npm run build`)
3. Install AWS CLI (via CircleCI orb)
4. Upload build output to S3 using **two sync passes**:
   - **Pass 1 (long cache)**: upload non-HTML/non-JSON assets with `cache-control: max-age=31536000,public`
   - **Pass 2 (no cache)**: upload `*.html` and `*.json` with `cache-control: no-cache,no-store,must-revalidate`

This keeps hashed/static assets cacheable while ensuring entry-point files update immediately.

## S3 sync commands used

### Static assets (long cache)

```bash
aws s3 sync dist/THIRD-IRON-LIBKEY s3://$AWS_BUCKET/primo-nde/<env> \
  --delete \
  --cache-control "max-age=31536000,public" \
  --exclude "*.html" \
  --exclude "*.json"
```

### HTML + JSON (no cache)

```bash
aws s3 sync dist/THIRD-IRON-LIBKEY s3://$AWS_BUCKET/primo-nde/<env> \
  --delete \
  --cache-control "no-cache,no-store,must-revalidate" \
  --exclude "*" \
  --include "*.html" \
  --include "*.json"
```

Replace `<env>` with:

- `dev-test` (for `feature/*`)
- `staging` (for `develop`)
- `production` (for `main`)

## Bucket policy

If you need a reference bucket policy for public reads, see `bucket-policy.json` in this repo. This is an example of the bucket policy we currently use on S3 for this Primo NDE project.
