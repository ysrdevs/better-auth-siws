import type { BetterAuthClientPlugin } from "@better-auth/core";
import type { BetterFetch } from "@better-fetch/fetch";
import type { SolanaSignInInput } from "@solana/wallet-standard-features";
import type { SerializedSolanaOutput, SiwsNonceResponse } from "./types";

export type { SiwsNonceResponse, SerializedSolanaOutput };
export { serializeOutput } from "./types";
export type { SolanaSignInInput } from "@solana/wallet-standard-features";

export const siwsClient = () => {
  return {
    id: "siws",
    $InferServerPlugin: {} as ReturnType<typeof import("./index").siws>,

    getActions: ($fetch: BetterFetch) => ({
      signIn: {
        solana: async (params: {
          input: SolanaSignInInput;
          output: SerializedSolanaOutput;
          fetchOptions?: RequestInit;
        }) => {
          return $fetch("/siws/verify", {
            method: "POST",
            body: {
              input: params.input,
              output: params.output,
            },
            ...params.fetchOptions,
          });
        },
      },

      solana: {
        getNonce: async (params: {
          walletAddress: string;
          fetchOptions?: RequestInit;
        }): Promise<SiwsNonceResponse> => {
          const res = await $fetch("/siws/nonce", {
            method: "POST",
            body: { walletAddress: params.walletAddress },
            ...params.fetchOptions,
          });
          return res.data as SiwsNonceResponse;
        },

        linkWallet: async (params: {
          input: SolanaSignInInput;
          output: SerializedSolanaOutput;
          fetchOptions?: RequestInit;
        }) => {
          return $fetch("/siws/link", {
            method: "POST",
            body: {
              input: params.input,
              output: params.output,
            },
            ...params.fetchOptions,
          });
        },

        unlinkWallet: async (params: {
          walletAddress: string;
          fetchOptions?: RequestInit;
        }) => {
          return $fetch("/siws/unlink", {
            method: "POST",
            body: { walletAddress: params.walletAddress },
            ...params.fetchOptions,
          });
        },

        getLinkedWallets: async (params?: {
          fetchOptions?: RequestInit;
        }) => {
          return $fetch("/siws/wallets", {
            method: "GET",
            ...params?.fetchOptions,
          });
        },
      },
    }),

    atomListeners: [
      {
        matcher: (path: string) => path.startsWith("/siws/"),
        signal: "$sessionSignal",
      },
    ],
  } satisfies BetterAuthClientPlugin;
};
