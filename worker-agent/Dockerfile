FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm — handles viem's deep file tree far better than npm under QEMU
RUN npm install -g pnpm --cache /tmp/.npm-global

# Copy shared package first
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
RUN cd shared && pnpm install --no-frozen-lockfile && pnpm run build

# Copy worker-agent
COPY worker-agent/package.json worker-agent/tsconfig.json ./worker-agent/
RUN cd worker-agent && pnpm install --no-frozen-lockfile
COPY worker-agent/src ./worker-agent/src
RUN cd worker-agent && pnpm run build

FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm --cache /tmp/.npm-global

# Copy only compiled output + manifests, then reinstall prod deps only
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json

COPY --from=builder /app/worker-agent/dist ./worker-agent/dist
COPY --from=builder /app/worker-agent/package.json ./worker-agent/package.json

RUN cd worker-agent && pnpm install --prod --no-frozen-lockfile

WORKDIR /app/worker-agent

ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.js"]
