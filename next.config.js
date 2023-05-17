/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    //outputFileTracingRoot: path.join(__dirname, "../../"),
    outputFileTracingExcludes: {
      "*": ["node_modules/canvas"]
    }
  }
};

module.exports = nextConfig;
