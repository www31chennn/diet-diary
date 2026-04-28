/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

// PWA 只在 production build 啟用
if (process.env.NODE_ENV === 'production') {
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
  })
  module.exports = withPWA(nextConfig)
} else {
  module.exports = nextConfig
}
