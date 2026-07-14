(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/[root-of-the-server]__be9797d2._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/apps/storefront/src/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$0$2e$5_react$40$19$2e$0$2e$5_$5f$react$40$19$2e$0$2e$5$2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.18_@babel+core@7.29.7_@opentelemetry+api@1.9.1_react-dom@19.0.5_react@19.0.5__react@19.0.5/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$0$2e$5_react$40$19$2e$0$2e$5_$5f$react$40$19$2e$0$2e$5$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.18_@babel+core@7.29.7_@opentelemetry+api@1.9.1_react-dom@19.0.5_react@19.0.5__react@19.0.5/node_modules/next/dist/esm/server/web/exports/index.js [middleware-edge] (ecmascript)");
;
const BACKEND_URL = ("TURBOPACK compile-time value", "http://localhost:9000");
const PUBLISHABLE_API_KEY = ("TURBOPACK compile-time value", "pk_b53547966a6a75ad6b0ca3e932068a80e7a9eeb673f6367ec55420865ece7774");
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "dk";
const regionMapCache = {
    regionMap: new Map(),
    regionMapUpdated: Date.now()
};
async function getRegionMap(cacheId) {
    const { regionMap, regionMapUpdated } = regionMapCache;
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    if (!regionMap.keys().next().value || regionMapUpdated < Date.now() - 3600 * 1000) {
        // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
        const response = await fetch(`${BACKEND_URL}/store/regions`, {
            method: "GET",
            headers: {
                "x-publishable-api-key": PUBLISHABLE_API_KEY
            },
            next: {
                revalidate: 3600,
                tags: [
                    `regions-${cacheId}`
                ]
            },
            cache: "force-cache"
        });
        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }
        const json = await response.json();
        const { regions } = json;
        if (!regions?.length) {
            return new Map();
        }
        // Create a map of country codes to regions.
        regions.forEach((region)=>{
            region.countries?.forEach((c)=>{
                regionMapCache.regionMap.set(c.iso_2 ?? "", region);
            });
        });
        regionMapCache.regionMapUpdated = Date.now();
    }
    return regionMapCache.regionMap;
}
/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */ async function getCountryCode(request, regionMap) {
    let countryCode;
    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase();
    // Cloudflare Workers provides country via request.cf.country
    const cloudflareCountryCode = request.cf?.country?.toLowerCase();
    // Vercel provides x-vercel-ip-country header
    const vercelCountryCode = request.headers.get("x-vercel-ip-country")?.toLowerCase();
    if (urlCountryCode && regionMap.has(urlCountryCode)) {
        countryCode = urlCountryCode;
    } else if (cloudflareCountryCode && regionMap.has(cloudflareCountryCode)) {
        countryCode = cloudflareCountryCode;
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
        countryCode = vercelCountryCode;
    } else if (regionMap.has(DEFAULT_REGION)) {
        countryCode = DEFAULT_REGION;
    } else if (regionMap.keys().next().value) {
        countryCode = regionMap.keys().next().value;
    }
    return countryCode;
}
async function middleware(request) {
    if (request.nextUrl.pathname.includes(".")) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$0$2e$5_react$40$19$2e$0$2e$5_$5f$react$40$19$2e$0$2e$5$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    const cacheIdCookie = request.cookies.get("_medusa_cache_id");
    const cacheId = cacheIdCookie?.value || crypto.randomUUID();
    const regionMap = await getRegionMap(cacheId);
    const countryCode = await getCountryCode(request, regionMap);
    // if the country code is available, use it, otherwise use the default region
    const country = countryCode || DEFAULT_REGION;
    const firstPathSegment = request.nextUrl.pathname.split("/")[1]?.toLowerCase();
    const urlHasCountry = firstPathSegment === country.toLowerCase();
    if (urlHasCountry) {
        if (!cacheIdCookie) {
            const response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$0$2e$5_react$40$19$2e$0$2e$5_$5f$react$40$19$2e$0$2e$5$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
            response.cookies.set("_medusa_cache_id", cacheId, {
                maxAge: 60 * 60 * 24
            });
            return response;
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$0$2e$5_react$40$19$2e$0$2e$5_$5f$react$40$19$2e$0$2e$5$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    // if the url doesn't have the country, redirect to it
    const redirectPath = request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname;
    const queryString = request.nextUrl.search || "";
    const redirectUrl = `${request.nextUrl.origin}/${country}${redirectPath}${queryString}`;
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$18_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$0$2e$5_react$40$19$2e$0$2e$5_$5f$react$40$19$2e$0$2e$5$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(redirectUrl, 307);
}
const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)"
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__be9797d2._.js.map