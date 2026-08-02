"use client";

import ConnectWalletButton from "@/components/ConnectWalletButton";
import GlassPanel from "@/components/GlassPanel";
import PageShell from "@/components/PageShell";
import {
  BASEQUEST_GENESIS_ABI,
  BASEQUEST_GENESIS_ADDRESS,
  BASEQUEST_GENESIS_MAX_SUPPLY,
} from "@/lib/contracts/abi/BaseQuestGenesis";
import { mintGenesisToken } from "@/lib/contracts/mint/baseQuestGenesis";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";
import { DATA_SUFFIX } from "@/lib/builderCode";
import { ui } from "@/lib/ui-styles";
import { useMemo, useState } from "react";
import { getAddress, isAddress, isAddressEqual } from "viem";
import { useAccount, useConfig, useReadContract } from "wagmi";

const fieldClassName =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-sm text-white outline-none transition-colors focus:border-cyan-300/35 focus:bg-white/[0.06] disabled:opacity-60 sm:py-3";

function parsePositiveBigInt(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  try {
    const parsed = BigInt(trimmed);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export default function AdminMintPage() {
  const config = useConfig();
  const { address, status: walletStatus } = useAccount();
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();

  const isConnected = walletStatus === "connected" && Boolean(address);

  const {
    data: owner,
    isLoading: isOwnerLoading,
    error: ownerError,
    refetch: refetchOwner,
  } = useReadContract({
    abi: BASEQUEST_GENESIS_ABI,
    address: BASEQUEST_GENESIS_ADDRESS,
    functionName: "owner",
    query: {
      enabled: isConnected,
    },
  });

  const isOwner = useMemo(() => {
    if (!address || !owner) return false;
    try {
      return isAddressEqual(getAddress(address), getAddress(owner));
    } catch {
      return false;
    }
  }, [address, owner]);

  const [recipient, setRecipient] = useState("");
  const [tokenIdInput, setTokenIdInput] = useState("1");
  const [amountInput, setAmountInput] = useState("1");
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const recipientTrimmed = recipient.trim();
  const recipientValid =
    recipientTrimmed.length > 0 && isAddress(recipientTrimmed);
  const tokenId = parsePositiveBigInt(tokenIdInput);
  const amount = parsePositiveBigInt(amountInput);
  const tokenIdInRange =
    tokenId !== null &&
    tokenId >= 1n &&
    tokenId <= BASEQUEST_GENESIS_MAX_SUPPLY;

  const {
    data: tokenExists,
    isLoading: isExistsLoading,
    error: existsError,
    refetch: refetchExists,
  } = useReadContract({
    abi: BASEQUEST_GENESIS_ABI,
    address: BASEQUEST_GENESIS_ADDRESS,
    functionName: "exists",
    args: tokenIdInRange && tokenId !== null ? [tokenId] : undefined,
    query: {
      enabled: isConnected && isOwner && tokenIdInRange,
    },
  });

  const validationMessage = useMemo(() => {
    if (!recipientTrimmed) {
      return "Enter a recipient address.";
    }
    if (!recipientValid) {
      return "Recipient address is invalid.";
    }
    if (tokenId === null) {
      return "Token ID must be a positive integer.";
    }
    if (!tokenIdInRange) {
      return `Token ID must be between 1 and ${BASEQUEST_GENESIS_MAX_SUPPLY.toString()}.`;
    }
    if (amount === null) {
      return "Amount must be a positive integer.";
    }
    if (amount !== 1n) {
      return "Amount must be 1 for the existing mint function.";
    }
    if (isExistsLoading) {
      return "Checking whether this token already exists...";
    }
    if (existsError) {
      return "Failed to check exists(tokenId).";
    }
    if (tokenExists) {
      return `Token #${tokenId.toString()} already exists.`;
    }
    return null;
  }, [
    amount,
    existsError,
    isExistsLoading,
    recipientTrimmed,
    recipientValid,
    tokenExists,
    tokenId,
    tokenIdInRange,
  ]);

  const canMint =
    isConnected &&
    isOwner &&
    !isMinting &&
    !isExistsLoading &&
    !tokenExists &&
    !existsError &&
    recipientValid &&
    tokenIdInRange &&
    amount === 1n;

  async function handleMint() {
    if (!address || !isConnected || !isOwner || isMinting || !canMint) {
      return;
    }
    if (!recipientValid || tokenId === null || amount !== 1n) {
      setErrorMessage(validationMessage ?? "Invalid mint parameters.");
      return;
    }

    setIsMinting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setTxHash(null);

    try {
      const existsCheck = await refetchExists();
      if (existsCheck.error) {
        setErrorMessage("Failed to check exists(tokenId).");
        return;
      }
      if (existsCheck.data === true) {
        setErrorMessage(`Token #${tokenId.toString()} already exists.`);
        return;
      }

      const chainId = await ensureBaseMainnetReady();
      const result = await mintGenesisToken({
        config,
        chainId,
        ownerAddress: address,
        recipient: getAddress(recipientTrimmed),
        tokenId,
        amount,
        data: "0x",
        dataSuffix: DATA_SUFFIX,
      });

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      setTxHash(result.txHash);
      setSuccessMessage(
        `Minted token #${result.tokenId.toString()} (amount ${result.amount.toString()}) to ${result.recipient}.`,
      );
      await Promise.all([refetchOwner(), refetchExists()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Mint failed.");
    } finally {
      setIsMinting(false);
    }
  }

  const ownerCheckLabel = !isConnected
    ? "Connect a wallet to check ownership"
    : isOwnerLoading
      ? "Checking contract owner..."
      : ownerError
        ? "Failed to read owner()"
        : isOwner
          ? "Connected wallet matches contract owner"
          : "Connected wallet is not the contract owner";

  return (
    <PageShell>
      <section className={`${ui.dashSection} text-center sm:text-left`}>
        <p className={ui.sectionHeading}>Admin</p>
        <h1 className={ui.pageTitle}>Genesis Mint</h1>
        <p className={ui.pageSubtitle}>
          Owner-only tool to mint Genesis tokens with a custom recipient and
          token ID.
        </p>
      </section>

      <GlassPanel className={`${ui.dashCardPad} space-y-5 sm:p-8`}>
        <div className="space-y-2 text-left">
          <p className={ui.messageTitle}>Contract</p>
          <p className="break-all font-mono text-sm text-white/80">
            {BASEQUEST_GENESIS_ADDRESS}
          </p>
        </div>

        {!isConnected ? (
          <div className="space-y-4 text-center">
            <p className={ui.messageTitle}>Connect your owner wallet</p>
            <div className="flex justify-center">
              <ConnectWalletButton
                connectLabel="Connect Wallet"
                connectingLabel="Connecting..."
                buttonClassName={`${ui.primaryButton} min-w-[160px]`}
                disabledClassName={`${ui.secondaryButton} min-w-[160px] opacity-70`}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            <div>
              <p className="text-sm text-white/60">Connected address</p>
              <p className="break-all font-mono text-sm text-white">{address}</p>
            </div>

            <div>
              <p className="text-sm text-white/60">Contract owner</p>
              <p className="break-all font-mono text-sm text-white">
                {isOwnerLoading ? "Loading..." : (owner ?? "Unavailable")}
              </p>
            </div>

            <div>
              <p className="text-sm text-white/60">Owner check</p>
              <p
                className={`text-sm ${
                  isOwner ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {ownerCheckLabel}
              </p>
            </div>

            {isOwner ? (
              <div className="space-y-4">
                <label className="block">
                  <span className={ui.statLabel}>Recipient</span>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(event) => {
                      setRecipient(event.target.value);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setTxHash(null);
                    }}
                    placeholder="0x..."
                    spellCheck={false}
                    autoComplete="off"
                    disabled={isMinting}
                    className={`${fieldClassName} mt-2`}
                    aria-label="Recipient address"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={ui.statLabel}>Token ID</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={tokenIdInput}
                      onChange={(event) => {
                        setTokenIdInput(event.target.value);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                        setTxHash(null);
                      }}
                      placeholder="1"
                      disabled={isMinting}
                      className={`${fieldClassName} mt-2 tabular-nums`}
                      aria-label="Token ID"
                    />
                  </label>

                  <label className="block">
                    <span className={ui.statLabel}>Amount</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={amountInput}
                      onChange={(event) => {
                        setAmountInput(event.target.value);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                        setTxHash(null);
                      }}
                      placeholder="1"
                      disabled={isMinting}
                      className={`${fieldClassName} mt-2 tabular-nums`}
                      aria-label="Amount"
                    />
                  </label>
                </div>

                {validationMessage ? (
                  <p
                    className={`text-sm ${
                      tokenExists || existsError || !recipientValid || amount !== 1n
                        ? "text-amber-300"
                        : "text-white/60"
                    }`}
                  >
                    {validationMessage}
                  </p>
                ) : (
                  <p className="text-sm text-emerald-300">
                    Ready to mint token #{tokenId?.toString()} to{" "}
                    {recipientValid ? getAddress(recipientTrimmed) : "—"}.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleMint()}
                  disabled={!canMint}
                  className={`${ui.primaryButton} w-full sm:w-auto ${
                    !canMint ? "opacity-70" : ""
                  }`}
                >
                  {isMinting
                    ? `Minting token #${tokenId?.toString() ?? "..."}...`
                    : "Mint Genesis token"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-white/70">
                Mint form hidden until the connected wallet matches `owner()`.
              </p>
            )}
          </div>
        )}

        {successMessage ? (
          <p className="text-sm text-emerald-300">{successMessage}</p>
        ) : null}

        {errorMessage ? (
          <p className="break-words text-sm text-red-300">{errorMessage}</p>
        ) : null}

        {txHash ? (
          <div className="space-y-1 text-left">
            <p className="text-sm text-white/60">Transaction hash</p>
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-sm text-sky-300 underline"
            >
              {txHash}
            </a>
          </div>
        ) : null}
      </GlassPanel>
    </PageShell>
  );
}
