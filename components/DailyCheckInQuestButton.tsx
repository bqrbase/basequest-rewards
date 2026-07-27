"use client";

import {
  DAILY_CHECK_IN_ABI,
  DAILY_CHECK_IN_ADDRESS,
} from "@/lib/contracts/DailyCheckIn";
import { DATA_SUFFIX } from "@/lib/builderCode";
import { useEnsureBaseMainnet } from "@/hooks/useEnsureBaseMainnet";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import {
  Transaction,
  TransactionButton,
  type LifecycleStatus,
} from "@coinbase/onchainkit/transaction";
import { useCallback, useMemo, useRef, useState } from "react";
import { getAddress, type Hex } from "viem";
import { base } from "viem/chains";

type DailyCheckInQuestButtonProps = {
  ctaLabel: string;
  buttonClassName: string;
  disabledClassName: string;
  disabled?: boolean;
  onSuccess?: () => void;
};

/** EIP-5792 capability for ERC-8021 builder attribution (optional). */
type SendCallsCapabilities = {
  dataSuffix?: {
    value: Hex;
    optional?: boolean;
  };
  paymasterService?: {
    url: string;
  };
};

const CHECK_IN_ADDRESS = getAddress(DAILY_CHECK_IN_ADDRESS);

export default function DailyCheckInQuestButton({
  ctaLabel,
  buttonClassName,
  disabledClassName,
  disabled = false,
  onSuccess,
}: DailyCheckInQuestButtonProps) {
  const { ensureBaseMainnetReady } = useEnsureBaseMainnet();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const successHandledRef = useRef(false);

  const calls = useMemo(
    () => [
      {
        address: CHECK_IN_ADDRESS,
        abi: DAILY_CHECK_IN_ABI,
        functionName: "checkIn" as const,
      },
    ],
    [],
  );

  const capabilities = useMemo<SendCallsCapabilities>(
    () => ({
      dataSuffix: {
        value: DATA_SUFFIX as Hex,
        optional: true,
      },
    }),
    [],
  );

  const handleSuccess = useCallback(() => {
    // OnchainKit success can re-emit via lifecycle effect deps; quest completion once.
    if (successHandledRef.current) return;
    successHandledRef.current = true;
    setErrorMessage(null);
    onSuccess?.();
  }, [onSuccess]);

  const handleError = useCallback(
    (error: { message?: string; error?: string }) => {
      if (isBaseMainnetSwitchRejected(error)) {
        setErrorMessage(BASE_MAINNET_REQUIRED_MESSAGE);
        return;
      }
      const detail = error.message || error.error || "Daily Check-in failed.";
      if (/user rejected|denied|request denied/i.test(detail)) {
        setErrorMessage(null);
        return;
      }
      console.error("[DailyCheckInQuestButton] check-in failed:", error);
      setErrorMessage(detail);
    },
    [],
  );

  const handleStatus = useCallback((status: LifecycleStatus) => {
    if (
      status.statusName === "buildingTransaction" ||
      status.statusName === "transactionPending"
    ) {
      successHandledRef.current = false;
      setErrorMessage(null);
    }
  }, []);

  return (
    <div className="space-y-2">
      <Transaction
        chainId={base.id}
        calls={calls}
        // OnchainKit types only document paymasterService; dataSuffix is a valid
        // EIP-5792 capability forwarded to wallet_sendCalls when atomicBatch is supported.
        capabilities={
          capabilities as SendCallsCapabilities & {
            paymasterService?: { url: string };
          }
        }
        onSuccess={handleSuccess}
        onError={handleError}
        onStatus={handleStatus}
        resetAfter={2_000}
      >
        <TransactionButton
          disabled={disabled}
          text={ctaLabel}
          render={({ status, onSubmit, isDisabled }) => {
            const pending = status === "pending";
            const buttonDisabled = disabled || isDisabled;

            return (
              <button
                type="button"
                disabled={buttonDisabled}
                onClick={() => {
                  // After success, OnchainKit's default onSubmit opens an explorer.
                  // Keep quest UX: only submit while not already successful.
                  if (status === "success") return;
                  setErrorMessage(null);
                  void (async () => {
                    try {
                      // Preserve prior Base Mainnet gate (wait-until-ready) before send.
                      await ensureBaseMainnetReady();
                      onSubmit();
                    } catch (error) {
                      if (isBaseMainnetSwitchRejected(error)) {
                        setErrorMessage(BASE_MAINNET_REQUIRED_MESSAGE);
                        return;
                      }
                      handleError(
                        error instanceof Error
                          ? { message: error.message }
                          : { message: "Daily Check-in failed." },
                      );
                    }
                  })();
                }}
                className={`${buttonDisabled ? disabledClassName : buttonClassName} w-full`}
              >
                {pending ? "Checking in..." : ctaLabel}
              </button>
            );
          }}
        />
      </Transaction>
      {errorMessage ? (
        <p className="text-center text-xs text-rose-300/90">{errorMessage}</p>
      ) : null}
    </div>
  );
}
