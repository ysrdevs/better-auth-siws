import { createAuthEndpoint, APIError } from "better-auth/api";
import { getSessionFromCtx } from "better-auth/api";
import { z } from "zod";
import { verifySIWS } from "./crypto";
import type { SiwsPluginOptions } from "./types";

export { verifySIWS } from "./crypto";
export { generateNonce, createSignInInput } from "./crypto";
export type { SiwsLinkedWallet, SiwsLinkRequest } from "./types";

export const siwsLink = (_options?: Pick<SiwsPluginOptions, "chainId">) => ({
  id: "siws-link" as const,
  endpoints: {
    linkSolanaWallet: createAuthEndpoint(
      "/siws/link",
      {
        method: "POST",
        body: z.object({
          input: z.object({
            domain: z.string(),
            statement: z.string().optional(),
            version: z.string().optional(),
            nonce: z.string().optional(),
            chainId: z.string().optional(),
            issuedAt: z.string().optional(),
          }),
          output: z.object({
            account: z.object({
              address: z.string(),
              publicKey: z.array(z.number()),
            }),
            signature: z.array(z.number()),
            signedMessage: z.array(z.number()),
          }),
        }),
        requireRequest: true,
      },
      async (ctx: any) => {
        const session = await getSessionFromCtx(ctx);
        if (!session?.user) {
          throw new APIError("UNAUTHORIZED", { message: "Not authenticated" });
        }

        const { input, output } = ctx.body;
        const walletAddress = output.account.address;

        // Verify nonce from verification table to prevent replay attacks
        const verification =
          await ctx.context.internalAdapter.findVerificationValue(
            `siws:${walletAddress}`
          );

        if (!verification || new Date() > verification.expiresAt) {
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid or expired nonce. Please request a new one.",
          });
        }

        const isValid = verifySIWS(input, output);
        if (!isValid) {
          throw new APIError("BAD_REQUEST", {
            message: "Invalid signature",
          });
        }

        // Delete used nonce to prevent reuse
        await ctx.context.internalAdapter.deleteVerificationValue(
          verification.id
        );

        const existing = await ctx.context.adapter.findOne({
          model: "account",
          where: [
            { field: "providerId", operator: "eq", value: "solana" },
            { field: "accountId", operator: "eq", value: walletAddress },
          ],
        });

        if (existing) {
          if ((existing as any).userId === session.user.id) {
            throw new APIError("BAD_REQUEST", {
              message: "This wallet is already linked to your account",
            });
          }
          throw new APIError("BAD_REQUEST", {
            message: "This wallet is already linked to another account",
          });
        }

        await ctx.context.internalAdapter.createAccount({
          userId: session.user.id,
          providerId: "solana",
          accountId: walletAddress,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return ctx.json({ success: true, walletAddress });
      }
    ),

    unlinkSolanaWallet: createAuthEndpoint(
      "/siws/unlink",
      {
        method: "POST",
        body: z.object({
          walletAddress: z.string().min(32).max(44),
        }),
        requireRequest: true,
      },
      async (ctx: any) => {
        const session = await getSessionFromCtx(ctx);
        if (!session?.user) {
          throw new APIError("UNAUTHORIZED", { message: "Not authenticated" });
        }

        const { walletAddress } = ctx.body;

        const account = await ctx.context.adapter.findOne({
          model: "account",
          where: [
            { field: "providerId", operator: "eq", value: "solana" },
            { field: "accountId", operator: "eq", value: walletAddress },
            { field: "userId", operator: "eq", value: session.user.id },
          ],
        });

        if (!account) {
          throw new APIError("NOT_FOUND", {
            message: "Wallet not found on your account",
          });
        }

        await ctx.context.adapter.delete({
          model: "account",
          where: [
            { field: "id", operator: "eq", value: (account as any).id },
          ],
        });

        return ctx.json({ success: true });
      }
    ),

    getLinkedSolanaWallets: createAuthEndpoint(
      "/siws/wallets",
      {
        method: "GET",
        requireRequest: true,
      },
      async (ctx: any) => {
        const session = await getSessionFromCtx(ctx);
        if (!session?.user) {
          throw new APIError("UNAUTHORIZED", { message: "Not authenticated" });
        }

        const accounts = await ctx.context.adapter.findMany({
          model: "account",
          where: [
            { field: "providerId", operator: "eq", value: "solana" },
            { field: "userId", operator: "eq", value: session.user.id },
          ],
        });

        const wallets = (accounts as any[]).map((a) => ({
          walletAddress: a.accountId,
          createdAt: a.createdAt,
        }));

        return ctx.json({ wallets });
      }
    ),
  },
});
