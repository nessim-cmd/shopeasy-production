FROM node:22-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package.json package-lock.json .npmrc* ./

RUN npm config set fetch-retry-maxtimeout 600000 -g && \
    npm config set fetch-retries 5 -g && \
    npm install --prefer-offline || npm install

COPY . .


# Production build — mastra dev is a watch/rebuild dev server, not meant
# for a deployed container.
RUN npm run build

EXPOSE 4111

CMD ["npm", "run", "start"]