/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    // Allow Miro to embed the app (SDK init page + fullscreen modal) inside its iframe.
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors https://miro.com https://*.miro.com;',
          },
        ],
      },
    ]
  },
}

export default nextConfig
