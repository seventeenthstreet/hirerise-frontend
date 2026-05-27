/** @type {import('next').NextConfig} */
const nextConfig = {
  // ───────────────────────────────────────────────────────────────────────────
  // React StrictMode
  // ───────────────────────────────────────────────────────────────────────────
  //
  // StrictMode double-invokes effects in development:
  // mount → cleanup → remount
  //
  // AppContext hydration protections:
  //
  //  - _strictModeBootCompleted
  //      Prevents duplicate INITIAL_SESSION hydration
  //
  //  - generation counter
  //      Cancels stale async writes
  //
  //  - hydrateOnce + sessionConfirmed
  //      Prevents concurrent INITIAL_SESSION + SIGNED_IN hydration
  //
  //  - activeRefreshHydration
  //      Deduplicates TOKEN_REFRESHED fetches
  //
  reactStrictMode: true,

  // ───────────────────────────────────────────────────────────────────────────
  // Standalone Output (REQUIRED FOR DOCKER)
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Generates:
  //   .next/standalone/
  //
  // Required for:
  // - production Docker builds
  // - lightweight runtime container
  // - minimal deployment artifacts
  //
  // Dockerfile copies:
  // - .next/standalone
  // - .next/static
  // - public/
  //
  output: 'standalone',

  // ───────────────────────────────────────────────────────────────────────────
  // API Proxy (Development)
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Browser requests:
  //
  //   Browser (:3000)
  //     → relative /api/v1/*
  //     → Next.js proxy
  //     → backend (:3001)
  //
  // This eliminates browser-side CORS entirely.
  //
  // Production:
  // - Nginx handles proxying directly
  // - This rewrite is primarily for local development
  //
  async rewrites() {
    // Backend port must match:
    // core/.env → PORT=3001
    //
    // If backend port changes:
    // update BOTH:
    // - core/.env
    // - API_BASE_URL
    //
    const backendUrl =
      process.env.API_BASE_URL || 'http://localhost:3001';

    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Security Headers
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Nginx adds stronger production security headers.
  // These provide an additional protection layer at Next.js level.
  //
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Image Configuration
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Supabase Storage:
  // - profile images
  // - resume files
  // - onboarding assets
  //
  images: {
    domains: [
      'dltzpxmwesrsuyseyrpd.supabase.co',
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Build Optimization
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Reduces CI/CD memory pressure.
  //
  // Especially useful for:
  // - GitHub Actions
  // - low-memory VPS builds
  // - Docker CI environments
  //
  experimental: {
    workerThreads: false,
    cpus: 1,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Production Compiler Optimizations
  // ───────────────────────────────────────────────────────────────────────────
  //
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Powered-By Header Removal
  // ───────────────────────────────────────────────────────────────────────────
  //
  poweredByHeader: false,

  // ───────────────────────────────────────────────────────────────────────────
  // Compression
  // ───────────────────────────────────────────────────────────────────────────
  //
  // Enable gzip/brotli support.
  //
  compress: true,
};

module.exports = nextConfig;