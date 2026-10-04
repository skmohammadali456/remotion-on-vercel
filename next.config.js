const {BUILD_DIR} = require("./build-dir.mjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/render": [
      "./" + BUILD_DIR + "/**/*",
      "./render.ts",
      "./ensure-browser.ts",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {key: "Cross-Origin-Opener-Policy", value: "same-origin"},
          {key: "Cross-Origin-Embedder-Policy", value: "require-corp"},
        ],
      },
    ];
  },
};

module.exports = nextConfig;
