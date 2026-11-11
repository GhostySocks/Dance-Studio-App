/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Publishable key is safe to expose; this makes it available to client components
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  },
  experimental: {
    esmExternals: "loose",
    // Runs instrumentation.ts on server start (nightly billing scheduler)
    instrumentationHook: true,
  },
  webpack: (config) => {
    // Fix for @react-pdf/renderer
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
