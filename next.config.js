/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow article HTML with inline <style> blocks to flow through
  experimental: {
    optimizePackageImports: [],
  },
};

module.exports = nextConfig;
