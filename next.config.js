/** @type {import('next').NextConfig} */
var path = require("path");
const nextConfig = {
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
    outputFileTracingExcludes: {
      "*": ["node_modules/canvas"]
    }
  }
};

module.exports = nextConfig;
