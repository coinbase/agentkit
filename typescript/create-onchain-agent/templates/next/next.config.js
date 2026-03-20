/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@noble/hashes", "@noble/curves", "@scure/bip39", "@scure/bip32"],
};

export default nextConfig;
