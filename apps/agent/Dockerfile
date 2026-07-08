FROM node:22-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package.json .npmrc* ./

RUN npm install -g pnpm && \
    pnpm install


COPY . .


# Production build — mastra dev is a watch/rebuild dev server, not meant
# for a deployed container.
RUN pnpm run build

EXPOSE 4111

CMD ["pnpm", "run", "start"]