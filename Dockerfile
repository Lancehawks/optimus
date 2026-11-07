# Builds and serves the Next.js app.
# NEXT_PUBLIC_SITE_URL is baked into the bundle, so it must be set as a build variable.
# Everything else in .env.example is read at runtime.

FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG NEXT_PUBLIC_SITE_URL
RUN test -n "$NEXT_PUBLIC_SITE_URL" || (echo "NEXT_PUBLIC_SITE_URL build variable is required" && exit 1)
# db.js refuses to load without a URL, but the build never queries, so a
# placeholder keeps real credentials out of the image.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:1/build npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
