/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Cấu hình webpack cho sharp module
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('sharp');
    }

    // Fallback cho các module Node.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };

    return config;
  }
};

module.exports = nextConfig;
