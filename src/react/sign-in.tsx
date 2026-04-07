"use client";

import { useEffect, useState, type FC } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { SolanaSignInInput } from "@solana/wallet-standard-features";
import { serializeOutput } from "../types";
import { SolanaProvider, type SolanaProviderProps } from "./provider";

export type SolanaSignInButtonProps = {
  baseURL?: string;
  basePath?: string;
  onSuccess?: (user: { id: string; name: string; email: string }) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  cluster?: SolanaProviderProps["cluster"];
  endpoint?: SolanaProviderProps["endpoint"];
};

function SolanaSignInInner({
  baseURL = "",
  basePath = "/api/auth",
  onSuccess,
  onError,
  className,
  disabled,
  children,
}: Omit<SolanaSignInButtonProps, "cluster" | "endpoint">) {
  const { publicKey, connected, disconnect, wallet, connecting, connect } =
    useWallet();
  const { setVisible, visible } = useWalletModal();
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    if (connected && publicKey && signingIn && !hasTriggered) {
      setHasTriggered(true);
      setVisible(false);
      handleSignIn();
    }
  }, [connected, publicKey, signingIn, wallet, hasTriggered]);

  useEffect(() => {
    if (wallet && !connected && !connecting && signingIn) {
      connect().catch(console.error);
    }
  }, [wallet, connected, connecting, signingIn, connect]);

  useEffect(() => {
    if (!visible && signingIn && !connected && !connecting && !wallet) {
      setSigningIn(false);
      setHasTriggered(false);
    }
  }, [visible, signingIn, connected, connecting, wallet]);

  const handleClick = async () => {
    setSigningIn(true);
    if (wallet && !connected) {
      try {
        await connect();
      } catch {
        setVisible(true);
      }
    } else if (!wallet) {
      setVisible(true);
    }
  };

  const handleSignIn = async () => {
    if (!publicKey || !wallet?.adapter) {
      setSigningIn(false);
      return;
    }

    const adapter = wallet.adapter as any;
    if (!("signIn" in adapter) || typeof adapter.signIn !== "function") {
      onError?.(
        "Your wallet does not support Sign In With Solana. Please use Phantom v23.11.0 or later."
      );
      setSigningIn(false);
      disconnect();
      return;
    }

    setLoading(true);

    try {
      const nonceRes = await fetch(`${baseURL}${basePath}/siws/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
      });
      const nonceData = await nonceRes.json();

      const input: SolanaSignInInput = {
        domain: nonceData.domain,
        statement: nonceData.statement,
        uri: nonceData.uri,
        nonce: nonceData.nonce,
        chainId: nonceData.chainId,
        issuedAt: nonceData.issuedAt,
      };

      const output = await adapter.signIn(input);
      const serialized = serializeOutput(output);

      const verifyRes = await fetch(`${baseURL}${basePath}/siws/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, output: serialized }),
      });

      const data = await verifyRes.json();

      if (!verifyRes.ok) {
        onError?.(data.message || data.error || "Failed to sign in with Solana");
      } else {
        onSuccess?.(data.user);
      }
    } catch (error: any) {
      if (error?.message !== "User rejected the request.") {
        onError?.(error?.message || "Failed to sign in with Solana wallet");
      }
    } finally {
      setLoading(false);
      setSigningIn(false);
      setHasTriggered(false);
      disconnect();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={className}
      type="button"
    >
      {children ?? (loading ? "Authenticating..." : "Sign In with Solana")}
    </button>
  );
}

export const SolanaSignInButton: FC<SolanaSignInButtonProps> = ({
  cluster,
  endpoint,
  ...props
}) => {
  return (
    <SolanaProvider cluster={cluster} endpoint={endpoint}>
      <SolanaSignInInner {...props} />
    </SolanaProvider>
  );
};
