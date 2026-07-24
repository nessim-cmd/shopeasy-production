import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const redisUrl = process.env.REDIS_URL

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
    // Upstash uses rediss:// (SSL) — pass TLS options so Medusa connects correctly
    redisOptions: redisUrl?.startsWith('rediss://')
      ? { tls: { rejectUnauthorized: false } }
      : undefined,
    databaseDriverOptions: {
      connection: {
        ssl: process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      },
      pool: {
        min: 2,
        max: 10,
      },
    },
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  admin: {
    vite: (config) => {
      return {
        ...config,
        server: {
          ...config.server,
          fs: {
            allow: ["/workspace", "/app", "/"],
          },
        },
      };
    },
  }
})