"use client";

import { useEffect, useState, type FC } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";
import { SolanaProvider, type SolanaProviderProps } from "./provider";

export type SolanaLinkWalletProps = {
  baseURL?: string;
  basePath?: string;
  onLink?: (walletAddress: string) => void;
  onUnlink?: () => void;
  onError?: (error: string) => void;
  className?: string;
  unlinkClassName?: string;
  disabled?: boolean;
  cluster?: SolanaProviderProps["cluster"];
  endpoint?: SolanaProviderProps["endpoint"];
  renderLinked?: (wallet: { address: string; onUnlink: () => void }) => React.ReactNode;
  children?: React.ReactNode;
};

function LinkWalletInner({
  baseURL = "",
  basePath = "/api/auth",
  onLink,
  onUnlink,
  onError,
  className,
  unlinkClassName,
  disabled,
  renderLinked,
  children,
}: Omit<SolanaLinkWalletProps, "cluster" | "endpoint">) {
  const { publicKey, connected, disconnect, wallet, connecting, connect } =
    useWallet();
  const { setVisible, visible } = useWalletModal();
  const [linkedWallet, setLinkedWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  const fetchWallets = async () => {
    try {
      const res = await fetch(`${baseURL}${basePath}/siws/wallets`);
      const data = await res.json();
      if (data.wallets?.[0]) {
        setLinkedWallet(data.wallets[0].walletAddress);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  useEffect(() => {
    if (connected && publicKey && linking && !hasTriggered) {
      setHasTriggered(true);
      setVisible(false);
      handleLink();
    }
  }, [connected, publicKey, linking, wallet, hasTriggered]);

  useEffect(() => {
    if (wallet && !connected && !connecting && linking) {
      connect().catch(console.error);
    }
  }, [wallet, connected, connecting, linking, connect]);

  useEffect(() => {
    if (!visible && linking && !connected && !connecting && !wallet) {
      setLinking(false);
      setHasTriggered(false);
    }
  }, [visible, linking, connected, connecting, wallet]);

  const handleLinkClick = async () => {
    setLinking(true);
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

  const handleLink = async () => {
    if (!wallet?.adapter) return;

    const adapter = wallet.adapter as any;
    if (!("signIn" in adapter)) {
      onError?.("Wallet doesn't support SIWS");
      setLinking(false);
      disconnect();
      return;
    }

    try {
      const createRes = await fetch(`${baseURL}${basePath}/siws/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey!.toBase58(),
        }),
      });
      const nonceData = await createRes.json();

      const input: SolanaSignInInput = {
        domain: nonceData.domain,
        statement: nonceData.statement,
        uri: nonceData.uri,
        nonce: nonceData.nonce,
        chainId: nonceData.chainId,
        issuedAt: nonceData.issuedAt,
      };

      const output: SolanaSignInOutput = await adapter.signIn(input);

      const serializedOutput = {
        account: {
          address: output.account.address,
          publicKey: Array.from(output.account.publicKey),
        },
        signature: Array.from(output.signature),
        signedMessage: Array.from(output.signedMessage),
      };

      const linkRes = await fetch(`${baseURL}${basePath}/siws/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, output: serializedOutput }),
      });

      if (linkRes.ok) {
        const data = await linkRes.json();
        setLinkedWallet(data.walletAddress);
        onLink?.(data.walletAddress);
      } else {
        const err = await linkRes.json();
        onError?.(err.message || "Failed to link wallet");
      }
    } catch (e: any) {
      if (!e?.message?.includes("rejected")) {
        onError?.("Failed to link wallet");
      }
    } finally {
      setLinking(false);
      setHasTriggered(false);
      disconnect();
    }
  };

  const handleUnlink = async () => {
    if (!linkedWallet) return;
    try {
      const res = await fetch(`${baseURL}${basePath}/siws/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: linkedWallet }),
      });
      if (res.ok) {
        setLinkedWallet(null);
        onUnlink?.();
      }
    } catch {
      onError?.("Failed to unlink wallet");
    }
  };

  if (loading) {
    return (
      <button disabled className={className}>
        Loading...
      </button>
    );
  }

  if (linkedWallet) {
    if (renderLinked) {
      return <>{renderLinked({ address: linkedWallet, onUnlink: handleUnlink })}</>;
    }
    const truncated = `${linkedWallet.slice(0, 4)}...${linkedWallet.slice(-4)}`;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
          {truncated}
        </span>
        <button onClick={handleUnlink} disabled={disabled} className={unlinkClassName} type="button">
          Unlink
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLinkClick}
      disabled={linking || disabled}
      className={className}
      type="button"
    >
      {children ?? (linking ? "Linking..." : "Link Solana Wallet")}
    </button>
  );
}

export const SolanaLinkWallet: FC<SolanaLinkWalletProps> = ({
  cluster,
  endpoint,
  ...props
}) => {
  return (
    <SolanaProvider cluster={cluster} endpoint={endpoint}>
      <LinkWalletInner {...props} />
    </SolanaProvider>
  );
};
