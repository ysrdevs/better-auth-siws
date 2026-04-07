import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { generateNonce, verifySIWS } from "./crypto";
import { deserializeOutput } from "./types";
import type { SiwsPluginOptions } from "./types";

export type { SiwsPluginOptions };
export { generateNonce, verifySIWS } from "./crypto";
export { serializeOutput, deserializeOutput } from "./types";
export type {
  SiwsNonceResponse,
  SiwsVerifyRequest,
  SiwsVerifyResponse,
  SiwsLinkedWallet,
  SerializedSolanaOutput,
} from "./types";

export const siws = (options?: SiwsPluginOptions) => ({
  id: "siws" as const,
  endpoints: {
    getSiwsNonce: createAuthEndpoint(
      "/siws/nonce",
      {
        method: "POST",
        body: z.object({
          walletAddress: z.string().min(32).max(44),
        }),
      },
      async (ctx) => {
        const { walletAddress } = ctx.body;
        const nonce = generateNonce();
        const expiryMs = options?.nonceExpiryMs ?? 5 * 60 * 1000;

        await ctx.context.internalAdapter.createVerificationValue({
          identifier: `siws:${walletAddress}`,
          value: nonce,
          expiresAt: new Date(Date.now() + expiryMs),
        });

        const host = ctx.headers?.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const domain = host;
        const uri = `${protocol}://${host}`;

        return ctx.json({
          nonce,
          domain,
          uri,
          statement:
            options?.statement ??
            "Sign in with your Solana wallet. This will not trigger a blockchain transaction or cost any gas fee.",
          chainId: options?.chainId ?? "mainnet",
          issuedAt: new Date().toISOString(),
        });
      }
    ),

    verifySiwsSignature: createAuthEndpoint(
      "/siws/verify",
      {
        method: "POST",
        body: z.object({
          output: z.object({
            account: z.object({
              address: z.string(),
              publicKey: z.array(z.number()),
            }),
            signature: z.array(z.number()),
            signedMessage: z.array(z.number()),
          }),
          input: z.object({
            domain: z.string(),
            address: z.string().optional(),
            statement: z.string().optional(),
            uri: z.string().optional(),
            version: z.string().optional(),
            chainId: z.string().optional(),
            nonce: z.string().optional(),
            issuedAt: z.string().optional(),
            expirationTime: z.string().optional(),
            notBefore: z.string().optional(),
            requestId: z.string().optional(),
            resources: z.array(z.string()).optional(),
          }),
        }),
        requireRequest: true,
      },
      async (ctx: any) => {
        const { output, input } = ctx.body;
        const walletAddress = output.account.address;

        const verification =
          await ctx.context.internalAdapter.findVerificationValue(
            `siws:${walletAddress}`
          );

        if (!verification || new Date() > verification.expiresAt) {
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid or expired nonce",
          });
        }

        const solanaOutput = deserializeOutput(output);
        const isValid = verifySIWS(input, solanaOutput);

        if (!isValid) {
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid signature",
          });
        }

        await ctx.context.internalAdapter.deleteVerificationValue(
          verification.id
        );

        const linkedAccount = (await ctx.context.adapter.findOne({
          model: "account",
          where: [
            { field: "providerId", operator: "eq", value: "solana" },
            { field: "accountId", operator: "eq", value: walletAddress },
          ],
        })) as { userId: string } | null;

        if (!linkedAccount) {
          if (options?.anonymous) {
            const user = await ctx.context.internalAdapter.createUser({
              name: walletAddress,
              email: `${walletAddress}@solana.wallet`,
              image: "",
            });

            await ctx.context.internalAdapter.createAccount({
              userId: user.id,
              providerId: "solana",
              accountId: walletAddress,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            const session = await ctx.context.internalAdapter.createSession(
              user.id,
              ctx
            );

            if (!session) {
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Failed to create session",
              });
            }

            await setSessionCookie(ctx, { session, user });

            return ctx.json({
              success: true,
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
              },
            });
          }

          throw new APIError("UNAUTHORIZED", {
            message:
              "No account linked to this wallet. Please sign in with email first and link your wallet.",
            code: "WALLET_NOT_LINKED",
          });
        }

        const user = (await ctx.context.adapter.findOne({
          model: "user",
          where: [
            { field: "id", operator: "eq", value: linkedAccount.userId },
          ],
        })) as {
          id: string;
          name: string;
          email: string;
          emailVerified: boolean;
          image?: string | null;
          banned?: boolean;
          createdAt: Date;
          updatedAt: Date;
        } | null;

        if (!user) {
          throw new APIError("UNAUTHORIZED", {
            message: "User not found",
          });
        }

        if (user.banned) {
          throw new APIError("FORBIDDEN", {
            message: "Your account has been banned",
          });
        }

        const session = await ctx.context.internalAdapter.createSession(
          user.id,
          ctx
        );

        if (!session) {
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create session",
          });
        }

        await setSessionCookie(ctx, { session, user });

        return ctx.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        });
      }
    ),
  },
});
