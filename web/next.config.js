/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Disable image optimization for static export (can enable later with MinIO)
  images: {
    unoptimized: true,
  },

  // Environment variables available at build time
  env: {
    NEXT_PUBLIC_APP_NAME: 'Echoes',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
  },
}

module.exports = nextConfig
