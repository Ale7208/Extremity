/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: false,
  },
  webpack: (config) => {
    config.cache = false;
    config.parallelism = 1;
    return config;
  },
}

export default nextConfig
