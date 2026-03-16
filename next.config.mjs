/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: "loose",
  },
  webpack: (config) => {
    // Fix for @react-pdf/renderer
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
