import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      client: "src/client.ts",
      link: "src/link.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: [
      "better-auth",
      "better-auth/api",
      "better-auth/cookies",
      "better-auth/client/plugins",
      "@better-auth/core",
      "@better-fetch/fetch",
      "@solana/wallet-standard-features",
      "@solana/wallet-standard-util",
      "@solana/web3.js",
      "react",
      "react-dom",
      "zod",
    ],
  },
  {
    entry: {
      "react/index": "src/react/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: [
      "better-auth",
      "better-auth/api",
      "better-auth/cookies",
      "@better-auth/core",
      "@better-fetch/fetch",
      "@solana/wallet-adapter-react",
      "@solana/wallet-adapter-react-ui",
      "@solana/wallet-standard-features",
      "@solana/wallet-standard-util",
      "@solana/web3.js",
      "react",
      "react-dom",
    ],
  },
]);
