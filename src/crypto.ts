import type { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";
import { verifySignIn } from "@solana/wallet-standard-util";

export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createSignInInput(
  domain: string,
  nonce: string,
  options?: { statement?: string; chainId?: string }
): SolanaSignInInput {
  return {
    domain,
    statement:
      options?.statement ??
      "Sign in with your Solana wallet. This will not trigger a blockchain transaction or cost any gas fee.",
    version: "1",
    nonce,
    chainId: options?.chainId ?? "mainnet",
    issuedAt: new Date().toISOString(),
  };
}

export function verifySIWS(
  input: SolanaSignInInput,
  output: SolanaSignInOutput | { account: { publicKey: number[] | Uint8Array; address: string }; signature: number[] | Uint8Array; signedMessage: number[] | Uint8Array }
): boolean {
  try {
    const reconstructed: SolanaSignInOutput = {
      account: {
        ...output.account,
        publicKey:
          output.account.publicKey instanceof Uint8Array
            ? output.account.publicKey
            : new Uint8Array(output.account.publicKey),
        chains: (output.account as any).chains ?? [],
        features: (output.account as any).features ?? [],
      },
      signature:
        output.signature instanceof Uint8Array
          ? output.signature
          : new Uint8Array(output.signature),
      signedMessage:
        output.signedMessage instanceof Uint8Array
          ? output.signedMessage
          : new Uint8Array(output.signedMessage),
    };
    return verifySignIn(input, reconstructed);
  } catch (error) {
    console.error("SIWS verification error:", error);
    return false;
  }
}
