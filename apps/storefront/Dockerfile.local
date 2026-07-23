FROM node:20-slim

WORKDIR /app

RUN npm install -g pnpm && \
    pnpm config set fetch-timeout 600000 && \
    pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 8000

CMD ["sh", "-c", "pnpm run build && pnpm run start"]