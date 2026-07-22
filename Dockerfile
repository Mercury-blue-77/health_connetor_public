FROM node:26-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci

COPY server ./server
RUN npm run build --workspace server

FROM node:26-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci --omit=dev

COPY --from=build /app/server/dist ./server/dist

USER node
EXPOSE 8787
CMD ["npm", "run", "start", "--workspace", "server"]
