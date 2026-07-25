"use client";

import {
  DAILY_CHECK_IN_ABI,
  DAILY_CHECK_IN_ADDRESS,
} from "@/lib/contracts/DailyCheckIn";
import { DATA_SUFFIX } from "@/lib/builderCode";
import { useWriteContractOnBase } from "@/hooks/useWriteContractOnBase";
import {
  BASE_MAINNET_REQUIRED_MESSAGE,
  isBaseMainnetSwitchRejected,
} from "@/lib/wallet/ensureBaseMainnet";
import { useState } from "react";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { base } from "viem/chains";

type DailyCheckInQuestButtonProps = {
  ctaLabel: string;
  buttonClassName: string;
  disabledClassName: string;
  disabled?: boolean;
  onSuccess?: () => void;
};

export default function DailyCheckInQuestButton({
  ctaLabel,
  buttonClassName,
  disabledClassName,
  disabled = false,
  onSuccess,
}: DailyCheckInQuestButtonProps) {
  const config = useConfig();
  const { writeContractAsync } = useWriteContractOnBase();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCheckIn() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const hash = await writeContractAsync({
        address: DAILY_CHECK_IN_ADDRESS,
        abi: DAILY_CHECK_IN_ABI,
        functionName: "checkIn",
        dataSuffix: DATA_SUFFIX,
      });

      await waitForTransactionReceipt(config, {
        hash,
        chainId: base.id,
      });

      onSuccess?.();
    } catch (error) {
      if (isBaseMainnetSwitchRejected(error)) {
        setErrorMessage(BASE_MAINNET_REQUIRED_MESSAGE);
      } else {
        console.error("[DailyCheckInQuestButton] check-in failed:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Daily Check-in failed.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDisabled = disabled || isSubmitting;

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => void handleCheckIn()}
        className={`${isDisabled ? disabledClassName : buttonClassName} w-full`}
      >
        {isSubmitting ? "Checking in..." : ctaLabel}
      </button>
      {errorMessage ? (
        <p className="text-center text-xs text-rose-300/90">{errorMessage}</p>
      ) : null}
    </div>
  );
}
