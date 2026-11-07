FROM node:24.22.2-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api-ts ./apps/api-ts
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm --filter @shl/api-ts... build
USER node
CMD ["node", "apps/api-ts/dist/main.js"]
