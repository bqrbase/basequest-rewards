"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WalletHost } from "@/lib/wagmi";

const WalletHostContext = createContext<WalletHost>("browser");

export function WalletHostProvider(props: {
  host: WalletHost;
  children: ReactNode;
}) {
  return (
    <WalletHostContext.Provider value={props.host}>
      {props.children}
    </WalletHostContext.Provider>
  );
}

/** Active wallet host from Providers (browser | baseApp | farcaster). */
export function useWalletHost(): WalletHost {
  return useContext(WalletHostContext);
}
