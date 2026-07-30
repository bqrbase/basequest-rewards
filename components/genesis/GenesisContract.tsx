"use client";

import {
  GENESIS_BASESCAN_URL,
  GENESIS_CONTRACT_ADDRESS,
  GENESIS_OPENSEA_URL,
  GENESIS_WEBSITE_URL,
} from "@/components/genesis/genesisConfig";
import GlassPanel from "@/components/GlassPanel";
import { formatWalletAddress, ui } from "@/lib/ui-styles";
import { useState } from "react";

export default function GenesisContract() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(GENESIS_CONTRACT_ADDRESS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Onchain</p>
        <h2 className={ui.sectionTitle}>Contract</h2>
        <p className={ui.sectionDescription}>
          Verified BaseQuest Genesis contract on Base Mainnet.
        </p>
      </div>

      <GlassPanel className={ui.dashCardPad}>
        <p className={ui.statLabel}>Contract Address</p>
        <p
          className="mt-2 break-all font-mono text-sm font-semibold tracking-wide text-white sm:text-base"
          title={GENESIS_CONTRACT_ADDRESS}
        >
          <span className="sm:hidden">
            {formatWalletAddress(GENESIS_CONTRACT_ADDRESS)}
          </span>
          <span className="hidden sm:inline">{GENESIS_CONTRACT_ADDRESS}</span>
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-live="polite"
            className={`${copied ? ui.primaryButton : ui.secondaryButton} w-full`}
          >
            {copied ? "Copied!" : "Copy Contract"}
          </button>
          <a
            href={GENESIS_BASESCAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ui.primaryButton} w-full text-center`}
          >
            View on BaseScan
          </a>
          <a
            href={GENESIS_OPENSEA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ui.secondaryButton} w-full text-center`}
          >
            View on OpenSea
          </a>
          <a
            href={GENESIS_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ui.secondaryButton} w-full text-center`}
          >
            Visit Website
          </a>
        </div>
      </GlassPanel>
    </section>
  );
}
