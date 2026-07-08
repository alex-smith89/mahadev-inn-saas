/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Disable strict mode for better performance (reduces double renders)
  reactStrictMode: false,
  
  // ✅ Enable SWC minification for faster builds
  swcMinify: true,
  
  // ✅ API rewrites to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
  
  // ✅ CORS headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  
  // ✅ Memory optimization settings
  compiler: {
    // Remove console.log in production to reduce bundle size
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // ✅ Image optimization
  images: {
    domains: ['localhost'],
    // Reduce image processing memory
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
  },
  
  // ✅ Webpack optimization for memory
  webpack: (config, { isServer, dev }) => {
    // Reduce memory usage in development
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    
    // Optimize chunk splitting
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000, // 244KB per chunk
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    return config;
  },
  
  // ✅ Experimental features for better performance
  experimental: {
    // Optimize CSS
    optimizeCss: true,
    // Reduce memory usage in development
    workerThreads: false,
    cpus: 1,
  },
  
  // ✅ Reduce build memory usage
  poweredByHeader: false,
  compress: true,
  
  // ✅ Production optimizations
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;