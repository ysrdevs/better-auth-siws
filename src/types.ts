import type { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";

export type { SolanaSignInInput, SolanaSignInOutput };

export interface SiwsPluginOptions {
  statement?: string;
  chainId?: string;
  nonceExpiryMs?: number;
  anonymous?: boolean;
}

export interface SiwsNonceResponse {
  nonce: string;
  domain: string;
  uri: string;
  statement: string;
  chainId: string;
  issuedAt: string;
}

export interface SiwsVerifyRequest {
  output: {
    account: {
      address: string;
      publicKey: number[];
    };
    signature: number[];
    signedMessage: number[];
  };
  input: {
    domain: string;
    address?: string;
    statement?: string;
    uri?: string;
    version?: string;
    chainId?: string;
    nonce?: string;
    issuedAt?: string;
    expirationTime?: string;
    notBefore?: string;
    requestId?: string;
    resources?: string[];
  };
}

export interface SiwsVerifyResponse {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SiwsLinkRequest {
  input: SolanaSignInInput;
  output: {
    account: {
      address: string;
      publicKey: number[];
    };
    signature: number[];
    signedMessage: number[];
  };
}

export interface SiwsLinkedWallet {
  walletAddress: string;
  createdAt: Date;
}

export interface SerializedSolanaOutput {
  account: {
    address: string;
    publicKey: number[];
  };
  signature: number[];
  signedMessage: number[];
  signatureType?: string;
}

export function serializeOutput(output: SolanaSignInOutput): SerializedSolanaOutput {
  return {
    account: {
      address: output.account.address,
      publicKey: Array.from(output.account.publicKey),
    },
    signature: Array.from(output.signature),
    signedMessage: Array.from(output.signedMessage),
    signatureType: (output as any).signatureType,
  };
}

export function deserializeOutput(data: SerializedSolanaOutput): SolanaSignInOutput {
  return {
    account: {
      address: data.account.address,
      publicKey: new Uint8Array(data.account.publicKey),
      chains: [],
      features: [],
    },
    signature: new Uint8Array(data.signature),
    signedMessage: new Uint8Array(data.signedMessage),
  };
}
