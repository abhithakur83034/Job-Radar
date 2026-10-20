/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (!process.env.API_INTERNAL_URL && process.env.NODE_ENV === 'production') {
      throw new Error(
        'API_INTERNAL_URL is not set. Set it to your deployed backend URL (e.g. https://your-api.onrender.com) in the hosting provider\'s environment variables.'
      );
    }
    const backendUrl = (process.env.API_INTERNAL_URL || 'http://localhost:4000').replace(/\/+$/, '');
    return [
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
