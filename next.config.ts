import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("./package.json");

const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: version,
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options',  value: 'nosniff' },
                    { key: 'X-Frame-Options',          value: 'DENY' },
                    { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=()' },
                ],
            },
        ];
    },
};

export default nextConfig;
