FROM node:20-alpine

RUN apk update && apk add --no-cache python3 make g++

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE 9000

CMD ["sh", "-c", "npx medusa db:migrate && pnpm run start"]
