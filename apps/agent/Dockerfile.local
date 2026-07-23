FROM node:22-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package.json .npmrc* ./

RUN npm install -g pnpm@11.10.0 && \
    pnpm config set dangerously-allow-all-builds true && \
    pnpm config set fetch-timeout 600000 && \
    pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm install --dangerously-allow-all-builds

COPY . .

RUN pnpm run build

EXPOSE 4111

CMD ["pnpm", "run", "start"]