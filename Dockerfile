FROM node:22.13.1-alpine

ENV NODE_ENV=development

RUN npm install -g pnpm
WORKDIR /src
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

RUN pnpm prune --prod

FROM node:22.13.1-alpine

ENV NODE_ENV=production

WORKDIR /dist
COPY --from=0 /src/dist/* ./

CMD ["node", "."]