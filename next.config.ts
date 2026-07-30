import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
