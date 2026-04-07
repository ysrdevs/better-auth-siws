"use client";

import { type FC, type ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

export type SolanaProviderProps = {
  children: ReactNode;
  cluster?: "mainnet-beta" | "devnet" | "testnet";
  endpoint?: string;
  autoConnect?: boolean;
};

export const SolanaProvider: FC<SolanaProviderProps> = ({
  children,
  cluster = "mainnet-beta",
  endpoint,
  autoConnect = false,
}) => {
  const rpcEndpoint = useMemo(
    () => endpoint ?? clusterApiUrl(cluster),
    [endpoint, cluster]
  );
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={rpcEndpoint}>
      <WalletProvider wallets={wallets} autoConnect={autoConnect}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
