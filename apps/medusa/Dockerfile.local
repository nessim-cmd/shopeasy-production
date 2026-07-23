FROM node:22-slim

WORKDIR /app

ENV MEDUSA_DISABLE_TELEMETRY=true

# Copy the pre-built medusa server from the host
COPY . .

# Since node_modules and .medusa/server are already built on the host, we just set the workdir
WORKDIR /app/.medusa/server

EXPOSE 9000

CMD ["npm", "run", "start"]