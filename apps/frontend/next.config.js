// apps/frontend/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // skip ESLint during production builds — use only as a temporary workaround
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
