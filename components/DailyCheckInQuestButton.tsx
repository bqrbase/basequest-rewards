"use client";

import {
  DAILY_CHECK_IN_ABI,
  DAILY_CHECK_IN_ADDRESS,
} from "@/lib/contracts/DailyCheckIn";
import { DATA_SUFFIX } from "@/lib/builderCode";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";
import type { QuestProgress } from "@/lib/quest-engine";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import { useCallback, useState } from "react";
import {
  encodeFunctionData,
  getAddress,
  numberToHex,
  type Hash,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { useAccount, useConfig } from "wagmi";
import {
  getAccount,
  getConnectorClient,
  waitForTransactionReceipt,
} from "wagmi/actions";

type DailyCheckInQuestButtonProps = {
  ctaLabel: string;
  buttonClassName: string;
  disabledClassName: string;
  disabled?: boolean;
  /** Optional local success callback with the confirmed tx hash. */
  onSuccess?: (txHash: string) => void;
  /** Apply verified server progress after /api/quests/daily-check-in/complete. */
  onCompleted?: (progress: QuestProgress) => void;
};

type WalletRequestClient = {
  request: (args: {
    method: string;
    params?: readonly unknown[];
  }) => Promise<unknown>;
  account?: { address?: Hex };
};

const CHECK_IN_ADDRESS = getAddress(DAILY_CHECK_IN_ADDRESS);
const BASE_CHAIN_ID_HEX = numberToHex(base.id);
const SEND_CALLS_VERSIONS = ["1.0", "2.0.0"] as const;

function isUserRejected(message: string): boolean {
  return /user rejected|denied|request denied/i.test(message);
}

function isMethodUnsupported(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  // viem/ox: "The Provider does not support the requested method."
  // ("does not support" ≠ "not supported")
  return (
    name.includes("unsupportedmethod") ||
    message.includes("does not support") ||
    message.includes("not supported") ||
    message.includes("unsupported") ||
    message.includes("method not found") ||
    message.includes("unknown method") ||
    message.includes("invalid method") ||
    message.includes("does not exist / is not available") ||
    message.includes("missing or invalid. request()")
  );
}

function isVersionMismatch(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  // Ignore viem footers like "Version: viem@2.x" — they blocked eth_sendTransaction fallback.
  const withoutViemFooter = message.replace(/version:\s*viem@[\d.]+/g, "");
  return (
    withoutViemFooter.includes("unsupported version") ||
    withoutViemFooter.includes("invalid version") ||
    withoutViemFooter.includes("version mismatch") ||
    withoutViemFooter.includes("invalid params") ||
    withoutViemFooter.includes("cannot parse")
  );
}

function extractSendCallsId(result: unknown): string | null {
  if (typeof result === "string" && result.startsWith("0x")) {
    return result;
  }
  if (
    result &&
    typeof result === "object" &&
    "id" in result &&
    typeof (result as { id: unknown }).id === "string"
  ) {
    return (result as { id: string }).id;
  }
  return null;
}

function isTransactionHash(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(id);
}

async function waitForCallsSuccess(
  client: WalletRequestClient,
  callsId: string,
): Promise<Hash | null> {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const status = (await client.request({
      method: "wallet_getCallsStatus",
      params: [callsId],
    })) as {
      status?: number | string;
      receipts?: Array<{
        status?: Hex | string | number;
        transactionHash?: Hash;
      }>;
    };

    const code =
      typeof status?.status === "string"
        ? Number.parseInt(status.status, 10)
        : status?.status;

    const receipt = status?.receipts?.[0];
    const receiptStatus = receipt?.status;
    const receiptHash = receipt?.transactionHash ?? null;

    // EIP-5792: 200 = confirmed success
    if (code === 200) {
      return receiptHash;
    }

    if (
      receiptStatus === "success" ||
      receiptStatus === "0x1" ||
      receiptStatus === 1
    ) {
      return receiptHash;
    }

    if (code !== undefined && code !== 100 && code >= 400) {
      throw new Error("Check-in transaction failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, 1_200));
  }

  throw new Error("Timed out waiting for check-in confirmation.");
}

export default function DailyCheckInQuestButton({
  ctaLabel,
  buttonClassName,
  disabledClassName,
  disabled = false,
  onSuccess,
  onCompleted,
}: DailyCheckInQuestButtonProps) {
  const config = useConfig();
  const { address, status: walletStatus } = useAccount();
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const completeCheckInOnServer = useCallback(
    async (txHash: string, sender: string) => {
      onSuccess?.(txHash);

      if (!onCompleted) {
        return;
      }

      try {
        const response = await fetch("/api/quests/daily-check-in/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            wallet: sender,
            txHash,
          }),
        });

        const json = (await response.json()) as {
          success?: boolean;
          progress?: QuestProgress;
          error?: string;
          message?: string;
        };

        if (response.ok && json.success && json.progress) {
          onCompleted(json.progress);
          return;
        }

        console.error(
          "[DailyCheckInQuestButton] daily-check-in complete failed:",
          json.error || json.message || response.status,
        );
        setErrorMessage(
          json.message ||
            json.error ||
            "Check-in confirmed onchain, but XP sync failed. Refresh and try again.",
        );
      } catch (error) {
        console.error(
          "[DailyCheckInQuestButton] daily-check-in complete exception:",
          error,
        );
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Check-in confirmed onchain, but XP sync failed.",
        );
      }
    },
    [onCompleted, onSuccess],
  );

  const handleCheckIn = useCallback(async () => {
    if (disabled || isSubmitting) return;
    if (walletStatus !== "connected" || !address) {
      setErrorMessage("Connect your wallet to check in.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await ensureBaseMainnetReady();

      const account = getAccount(config);
      const client = (await getConnectorClient(config, {
        connector: account.connector,
      })) as WalletRequestClient;
      const from = client.account?.address ?? account.address;
      if (!from) {
        throw new Error("Connect your wallet to check in.");
      }

      // Clean ABI calldata — builder attribution goes only via capabilities.
      const data = encodeFunctionData({
        abi: DAILY_CHECK_IN_ABI,
        functionName: "checkIn",
      });

      const calls = [
        {
          to: CHECK_IN_ADDRESS,
          data,
          value: "0x0",
        },
      ];

      const capabilities = {
        dataSuffix: {
          value: DATA_SUFFIX as Hex,
          optional: true,
        },
      };

      let batchId: string | null = null;
      let sendCallsUnsupported = false;
      let lastError: unknown;

      for (const version of SEND_CALLS_VERSIONS) {
        try {
          const result = await client.request({
            method: "wallet_sendCalls",
            params: [
              {
                version,
                chainId: BASE_CHAIN_ID_HEX,
                from,
                atomicRequired: false,
                calls,
                capabilities,
              },
            ],
          });

          batchId = extractSendCallsId(result);
          if (!batchId) {
            throw new Error("wallet_sendCalls did not return a batch id.");
          }
          break;
        } catch (error) {
          lastError = error;
          const message =
            error instanceof Error ? error.message : String(error);

          if (isUserRejected(message)) {
            throw error;
          }

          if (isMethodUnsupported(error)) {
            sendCallsUnsupported = true;
            continue;
          }

          // Try next version on version/params mismatch from "1.0".
          if (version === "1.0" && isVersionMismatch(error)) {
            continue;
          }

          throw error;
        }
      }

      if (!batchId) {
        if (!sendCallsUnsupported) {
          throw lastError instanceof Error
            ? lastError
            : new Error("Daily Check-in failed.");
        }

        // Only when every wallet_sendCalls attempt reports method unsupported.
        // Omit chainId from the tx object — some Mini App providers reject it.
        // Chain is already enforced via ensureBaseMainnetReady().
        const hash = (await client.request({
          method: "eth_sendTransaction",
          params: [
            {
              from,
              to: CHECK_IN_ADDRESS,
              data,
            },
          ],
        })) as Hex;

        await waitForTransactionReceipt(config, {
          hash,
          chainId: base.id,
        });
        await completeCheckInOnServer(hash, from);
        return;
      }

      let txHash: string | null = null;

      if (isTransactionHash(batchId)) {
        await waitForTransactionReceipt(config, {
          hash: batchId as Hex,
          chainId: base.id,
        });
        txHash = batchId;
      } else {
        txHash = await waitForCallsSuccess(client, batchId);
      }

      if (!txHash) {
        throw new Error("Check-in confirmed but no transaction hash was returned.");
      }

      await completeCheckInOnServer(txHash, from);
    } catch (error) {
      if (isBaseMainnetSwitchRejected(error)) {
        setErrorMessage(BASE_MAINNET_REQUIRED_MESSAGE);
        return;
      }
      const detail =
        error instanceof Error ? error.message : "Daily Check-in failed.";
      if (isUserRejected(detail)) {
        setErrorMessage(null);
        return;
      }
      console.error("[DailyCheckInQuestButton] check-in failed:", error);
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    address,
    completeCheckInOnServer,
    config,
    disabled,
    ensureBaseMainnetReady,
    isSubmitting,
    walletStatus,
  ]);

  const buttonDisabled = disabled || isSubmitting;

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={buttonDisabled}
        onClick={() => void handleCheckIn()}
        className={`${buttonDisabled ? disabledClassName : buttonClassName} w-full`}
      >
        {isSubmitting ? "Checking in..." : ctaLabel}
      </button>
      {errorMessage ? (
        <p className="text-center text-xs text-rose-300/90">{errorMessage}</p>
      ) : null}
    </div>
  );
}
