import {
  convertQuoteToRoute,
  executeRoute,
  getStatus,
  stopRouteExecution,
  type LiFiStep,
  type RouteExtended,
  type SDKClient,
} from "@lifi/sdk";
import type { StatusResponse } from "@lifi/types";
import {
  createPublicClient,
  http,
  type Hash,
} from "viem";
import { base } from "viem/chains";
import type { Config } from "wagmi";
import { BRIDGE_DEST_CHAIN_ID } from "@/lib/swap/bridge";
import {
  createLifiBridgeExecutionClient,
  ensureLifiBaseChain,
  ensureLifiChain,
  getLifiQuoteClient,
  LIFI_BASE_CHAIN_ID,
} from "@/lib/swap/lifi";

/** Public bridge lifecycle for UI + future quest gating. */
export type BridgeStatus =
  | "pending"
  | "bridging"
  | "waiting_destination"
  | "completed"
  | "failed";

export type BridgeFailureReason =
  | "rejected"
  | "route_failed"
  | "destination_failed"
  | "timeout"
  | "cancelled"
  | "unknown";

export type BridgeSettlement = {
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  sourceChainId: number;
  destinationChainId: number;
  bridgeStatus: BridgeStatus;
  failureReason?: BridgeFailureReason;
};

export const DEFAULT_BRIDGE_SETTLEMENT_TIMEOUT_MS = 45 * 60 * 1000;
export const BRIDGE_STATUS_POLL_INTERVAL_MS = 5_000;

export function createPendingBridgeSettlement(
  sourceChainId = 0,
): BridgeSettlement {
  return {
    sourceTxHash: null,
    destinationTxHash: null,
    sourceChainId,
    destinationChainId: BRIDGE_DEST_CHAIN_ID,
    bridgeStatus: "pending",
  };
}

export function getBridgeStatusLabel(status: BridgeStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "bridging":
      return "Bridging…";
    case "waiting_destination":
      return "Waiting for Base confirmation…";
    case "completed":
      return "Bridge completed ✅";
    case "failed":
      return "Failed";
  }
}

export class BridgeSettlementError extends Error {
  readonly reason: BridgeFailureReason;
  readonly settlement: BridgeSettlement;

  constructor(
    reason: BridgeFailureReason,
    message: string,
    settlement: BridgeSettlement,
  ) {
    super(message);
    this.name = "BridgeSettlementError";
    this.reason = reason;
    this.settlement = settlement;
  }
}

function isAllowanceActionType(type: string | undefined): boolean {
  return (
    type === "SET_ALLOWANCE" ||
    type === "RESET_ALLOWANCE" ||
    type === "CHECK_ALLOWANCE" ||
    type === "PERMIT" ||
    type === "NATIVE_PERMIT"
  );
}

/** Source bridge/swap tx — skips approve/permit legs. */
export function extractSourceTxHash(route: RouteExtended): string | null {
  for (const step of route.steps) {
    for (const action of step.execution?.actions ?? []) {
      if (
        action.txHash &&
        (action.type === "CROSS_CHAIN" || action.type === "SWAP")
      ) {
        return action.txHash;
      }
    }
  }

  for (const step of route.steps) {
    for (const action of step.execution?.actions ?? []) {
      if (!action.txHash || isAllowanceActionType(action.type)) {
        continue;
      }
      return action.txHash;
    }
  }

  return null;
}

/** Destination / receiving-chain tx when LI.FI has attached one. */
export function extractDestinationTxHash(route: RouteExtended): string | null {
  for (const step of route.steps) {
    const actions = step.execution?.actions ?? [];
    for (let i = actions.length - 1; i >= 0; i -= 1) {
      const action = actions[i];
      if (!action?.txHash) {
        continue;
      }
      if (
        action.type === "RECEIVING_CHAIN" ||
        action.chainId === LIFI_BASE_CHAIN_ID
      ) {
        return action.txHash;
      }
    }
  }
  return null;
}

export function extractTxHashesFromRoute(route: RouteExtended): {
  sourceTxHash: string | null;
  destinationTxHash: string | null;
} {
  return {
    sourceTxHash: extractSourceTxHash(route),
    destinationTxHash: extractDestinationTxHash(route),
  };
}

export function isUserRejectedBridgeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /user rejected|denied|rejected the request|request rejected/i.test(
    error.message,
  );
}

function isRouteFailed(route: RouteExtended): boolean {
  return route.steps.some((step) => step.execution?.status === "FAILED");
}

function getDestinationTxHashFromStatus(
  status: StatusResponse,
): string | null {
  if (!("receiving" in status) || !status.receiving) {
    return null;
  }
  if ("txHash" in status.receiving && status.receiving.txHash) {
    return status.receiving.txHash;
  }
  return null;
}

function pickStatusStep(route: RouteExtended): LiFiStep {
  return (
    route.steps.find((step) => step.tool && step.tool !== "custom") ??
    route.steps[0]
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function assertNotAborted(
  signal: AbortSignal | undefined,
  settlement: BridgeSettlement,
): void {
  if (signal?.aborted) {
    throw new BridgeSettlementError("cancelled", "Bridge was cancelled.", {
      ...settlement,
      bridgeStatus: "failed",
      failureReason: "cancelled",
    });
  }
}

type DestinationReceiptState = "success" | "reverted" | "pending";

function getBaseRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    process.env.BASE_RPC_URL ||
    "https://mainnet.base.org"
  );
}

/** Non-blocking Base receipt check (official RPC via viem). */
async function getDestinationReceiptState(
  destinationTxHash: string,
): Promise<DestinationReceiptState> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(getBaseRpcUrl()),
    });
    const receipt = await client.getTransactionReceipt({
      hash: destinationTxHash as Hash,
    });
    if (receipt.status === "success") {
      return "success";
    }
    if (receipt.status === "reverted") {
      return "reverted";
    }
    return "pending";
  } catch {
    return "pending";
  }
}

export type TrackBridgeDestinationParams = {
  route: RouteExtended;
  sourceChainId: number;
  sourceTxHash: string;
  destinationTxHash?: string | null;
  client?: SDKClient;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (settlement: BridgeSettlement) => void;
};

/**
 * Track destination settlement via official LI.FI getStatus.
 * Completes when LI.FI status is DONE, or when the Base destination tx confirms.
 * Source-chain success alone never completes the bridge.
 */
export async function trackBridgeDestinationSettlement(
  params: TrackBridgeDestinationParams,
): Promise<BridgeSettlement> {
  const timeoutMs =
    params.timeoutMs ?? DEFAULT_BRIDGE_SETTLEMENT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const client = params.client ?? getLifiQuoteClient();
  const step = pickStatusStep(params.route);

  let destinationTxHash = params.destinationTxHash ?? null;

  const baseSettlement = (): BridgeSettlement => ({
    sourceTxHash: params.sourceTxHash,
    destinationTxHash,
    sourceChainId: params.sourceChainId,
    destinationChainId: BRIDGE_DEST_CHAIN_ID,
    bridgeStatus: "waiting_destination",
  });

  const emit = (settlement: BridgeSettlement) => {
    params.onProgress?.(settlement);
  };

  emit(baseSettlement());

  while (Date.now() < deadline) {
    assertNotAborted(params.signal, baseSettlement());

    let status: StatusResponse | undefined;
    try {
      status = await getStatus(client, {
        fromChain: step.action.fromChainId,
        toChain: step.action.toChainId,
        txHash: params.sourceTxHash,
        fromAddress: step.action.fromAddress,
        ...(step.tool && step.tool !== "custom" ? { bridge: step.tool } : {}),
        ...(step.transactionId ? { transactionId: step.transactionId } : {}),
      });
    } catch {
      await sleep(BRIDGE_STATUS_POLL_INTERVAL_MS);
      continue;
    }

    assertNotAborted(params.signal, baseSettlement());

    destinationTxHash =
      getDestinationTxHashFromStatus(status) ?? destinationTxHash;

    if (status.status === "FAILED") {
      const failed: BridgeSettlement = {
        ...baseSettlement(),
        bridgeStatus: "failed",
        failureReason: "route_failed",
      };
      emit(failed);
      throw new BridgeSettlementError(
        "route_failed",
        status.substatusMessage || "Bridge failed according to LI.FI status.",
        failed,
      );
    }

    // Path A: destination tx confirmed on Base → completed.
    if (destinationTxHash) {
      const receiptState = await getDestinationReceiptState(destinationTxHash);
      if (receiptState === "success") {
        const completed: BridgeSettlement = {
          ...baseSettlement(),
          destinationTxHash,
          bridgeStatus: "completed",
        };
        emit(completed);
        return completed;
      }
      if (receiptState === "reverted") {
        const failed: BridgeSettlement = {
          ...baseSettlement(),
          destinationTxHash,
          bridgeStatus: "failed",
          failureReason: "destination_failed",
        };
        emit(failed);
        throw new BridgeSettlementError(
          "destination_failed",
          "Destination transaction reverted on Base.",
          failed,
        );
      }
    }

    // Path B: official LI.FI DONE → destination settled / credited.
    if (status.status === "DONE") {
      const completed: BridgeSettlement = {
        ...baseSettlement(),
        destinationTxHash,
        bridgeStatus: "completed",
      };
      emit(completed);
      return completed;
    }

    emit(baseSettlement());
    await sleep(BRIDGE_STATUS_POLL_INTERVAL_MS);
  }

  const timedOut: BridgeSettlement = {
    ...baseSettlement(),
    bridgeStatus: "failed",
    failureReason: "timeout",
  };
  emit(timedOut);
  throw new BridgeSettlementError(
    "timeout",
    "Timed out waiting for Bridge destination settlement on Base.",
    timedOut,
  );
}

export type RunBridgeToBaseParams = {
  wagmiConfig: Config;
  quote: LiFiStep;
  sourceChainId: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (settlement: BridgeSettlement) => void;
};

/**
 * Execute a bridge route and track until destination settlement.
 * Official LI.FI SDK APIs only: executeRoute, getStatus, stopRouteExecution.
 */
export async function runBridgeToBase(
  params: RunBridgeToBaseParams,
): Promise<BridgeSettlement> {
  const emit = (settlement: BridgeSettlement) => {
    params.onProgress?.(settlement);
  };

  let settlement: BridgeSettlement = {
    sourceTxHash: null,
    destinationTxHash: null,
    sourceChainId: params.sourceChainId,
    destinationChainId: BRIDGE_DEST_CHAIN_ID,
    bridgeStatus: "bridging",
  };
  emit(settlement);

  assertNotAborted(params.signal, settlement);

  const client = createLifiBridgeExecutionClient(params.wagmiConfig);
  await ensureLifiChain(client, params.sourceChainId);
  await ensureLifiBaseChain(client);

  let activeRoute: RouteExtended = convertQuoteToRoute(params.quote);

  const onAbort = () => {
    try {
      stopRouteExecution(activeRoute);
    } catch {
      // Route may already be finished.
    }
  };
  params.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    assertNotAborted(params.signal, settlement);

    const executed = await executeRoute(client, activeRoute, {
      acceptExchangeRateUpdateHook: async () => true,
      updateRouteHook: (routeUpdate) => {
        activeRoute = routeUpdate;
        const hashes = extractTxHashesFromRoute(routeUpdate);
        settlement = {
          sourceTxHash: hashes.sourceTxHash,
          destinationTxHash: hashes.destinationTxHash,
          sourceChainId: params.sourceChainId,
          destinationChainId: BRIDGE_DEST_CHAIN_ID,
          bridgeStatus: hashes.sourceTxHash
            ? "waiting_destination"
            : "bridging",
        };
        emit(settlement);
      },
    });

    activeRoute = executed;

    if (isRouteFailed(executed)) {
      settlement = {
        ...settlement,
        ...extractTxHashesFromRoute(executed),
        bridgeStatus: "failed",
        failureReason: "route_failed",
      };
      emit(settlement);
      throw new BridgeSettlementError(
        "route_failed",
        "Bridge route execution failed.",
        settlement,
      );
    }

    const sourceTxHash =
      extractSourceTxHash(executed) ?? settlement.sourceTxHash;
    if (!sourceTxHash) {
      settlement = {
        ...settlement,
        bridgeStatus: "failed",
        failureReason: "route_failed",
      };
      emit(settlement);
      throw new BridgeSettlementError(
        "route_failed",
        "Bridge finished without a source transaction hash.",
        settlement,
      );
    }

    // Source tx alone is insufficient — wait for destination settlement.
    settlement = {
      sourceTxHash,
      destinationTxHash: extractDestinationTxHash(executed),
      sourceChainId: params.sourceChainId,
      destinationChainId: BRIDGE_DEST_CHAIN_ID,
      bridgeStatus: "waiting_destination",
    };
    emit(settlement);

    return await trackBridgeDestinationSettlement({
      route: executed,
      sourceChainId: params.sourceChainId,
      sourceTxHash,
      destinationTxHash: settlement.destinationTxHash,
      signal: params.signal,
      timeoutMs: params.timeoutMs,
      onProgress: (next) => {
        settlement = next;
        emit(next);
      },
    });
  } catch (error) {
    if (error instanceof BridgeSettlementError) {
      emit(error.settlement);
      throw error;
    }

    if (params.signal?.aborted) {
      settlement = {
        ...settlement,
        bridgeStatus: "failed",
        failureReason: "cancelled",
      };
      emit(settlement);
      throw new BridgeSettlementError(
        "cancelled",
        "Bridge was cancelled.",
        settlement,
      );
    }

    if (isUserRejectedBridgeError(error)) {
      settlement = {
        ...settlement,
        bridgeStatus: "failed",
        failureReason: "rejected",
      };
      emit(settlement);
      throw new BridgeSettlementError(
        "rejected",
        "Transaction was rejected in your wallet.",
        settlement,
      );
    }

    settlement = {
      ...settlement,
      bridgeStatus: "failed",
      failureReason: "unknown",
    };
    emit(settlement);
    throw new BridgeSettlementError(
      "unknown",
      error instanceof Error ? error.message : "Bridge failed. Try again.",
      settlement,
    );
  } finally {
    params.signal?.removeEventListener("abort", onAbort);
  }
}
