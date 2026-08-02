import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Baileys does conditional `import('jimp')`/`import('sharp')` for optional
  // media-thumbnail support (wrapped in a runtime .catch(), so it's fine if
  // neither is installed) - Turbopack's bundler otherwise tries to statically
  // resolve those specifiers at compile time and fails hard on the missing
  // one. Marking the package external skips bundling it entirely; it's
  // require()'d directly via Node's own resolution at runtime instead.
  serverExternalPackages: ["@whiskeysockets/baileys"],
  experimental: {
    serverActions: {
      // GitHub Codespaces' port-forwarding tunnel sends the request's Origin
      // header as "localhost:PORT" regardless of the public *.app.github.dev
      // URL shown in the browser, so that's what actually needs allowing here.
      allowedOrigins: ["localhost:3000", "*.app.github.dev"],
      // Above the 5MB background-image limit enforced in
      // src/app/actions/settings.ts, with headroom for multipart overhead
      // and the form's other fields. Next's default is 1MB.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
