/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./dist/**/*"],
  },
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/next/dist/compiled/next-server/app-route-turbo.runtime.prod.js",
    ],
  },
};

export default nextConfig;
