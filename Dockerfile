FROM node:22-slim

# Install dependencies required by node-gyp (for better-sqlite3) and Playwright
RUN apt-get update && apt-get install -y \
    python3 make g++ chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package.json package-lock.json .npmrc* ./

# Configure npm for flaky networks (increase timeout to 10 mins and add retries)
RUN npm config set fetch-retry-maxtimeout 600000 -g && \
    npm config set fetch-retries 5 -g && \
    npm install --prefer-offline || npm install


COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]