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
3. Run the `deploy-to-s3` command (defined at the top of `.circleci/config.yml`), which:
   1. Installs the AWS CLI (via CircleCI orb)
   2. Uploads hashed chunks and static assets with `cache-control: max-age=31536000,public`
   3. Uploads `*.html` and `*.json` with `cache-control: no-cache,no-store,must-revalidate`
   4. Uploads `remoteEntry.js` **last**, with `cache-control: no-cache`
   5. Removes hashed files (`<name>.<16-hex-hash>.js|css` at the top level) that are not part of the
      current build and were last uploaded more than 7 days ago

### Why the order and the delayed cleanup matter

`remoteEntry.js` has a fixed name but lists the content-hashed chunk filenames of the build it came from.
Primo appends a `?t=<timestamp>` cache buster when loading it, but CloudFront can still serve a cached copy
for a few minutes after a deploy. If that stale `remoteEntry.js` points at chunks that have already been
deleted, the add-on fails to load. So:

- Chunks are uploaded before `remoteEntry.js`, so a fresh `remoteEntry.js` never references a chunk that
  isn't there yet.
- The sync passes don't use `--delete`; chunks from previous builds stay available for the retention
  window (7 days, the `retention-days` parameter) so a stale `remoteEntry.js`, or a Primo tab left open,
  can still load them.

## S3 commands used

### Hashed chunks and static assets (long cache)

```bash
aws s3 sync dist/THIRD-IRON-LIBKEY s3://$AWS_BUCKET/primo-nde/<env> \
  --cache-control "max-age=31536000,public" \
  --exclude "remoteEntry.js" \
  --exclude "*.html" \
  --exclude "*.json"
```

### HTML + JSON (no cache)

```bash
aws s3 sync dist/THIRD-IRON-LIBKEY s3://$AWS_BUCKET/primo-nde/<env> \
  --cache-control "no-cache,no-store,must-revalidate" \
  --exclude "*" \
  --include "*.html" \
  --include "*.json"
```

### remoteEntry.js (uploaded last)

```bash
aws s3 cp dist/THIRD-IRON-LIBKEY/remoteEntry.js s3://$AWS_BUCKET/primo-nde/<env>/remoteEntry.js \
  --cache-control "no-cache"
```

### Cleanup of earlier builds

See the "Remove hashed files from builds older than ... days" step in `.circleci/config.yml`. It lists
the top-level objects under the prefix and deletes only hashed `.js`/`.css` files that are absent from
the current build and older than the cutoff; everything else (including `assets/`) is left alone.

Replace `<env>` with:

- `dev-test` (for `feature/*`)
- `staging` (for `develop`)
- `production` (for `main`)

## Bucket policy

If you need a reference bucket policy for public reads, see `bucket-policy.json` in this repo. This is an example of the bucket policy we currently use on S3 for this Primo NDE project.
