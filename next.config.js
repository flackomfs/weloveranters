const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare');

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com'
      }
    ]
  },
  outputFileTracingIncludes: {
    '/*': ['./node_modules/@libsql/isomorphic-ws/web.mjs']
  }
};

initOpenNextCloudflareForDev();

module.exports = nextConfig;
