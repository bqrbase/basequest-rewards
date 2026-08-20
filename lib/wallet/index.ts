/**
 * BaseQuest client wallet layer — single entry for connect/chain/tx.
 */

export * from "@/lib/wallet/types";
export * from "@/lib/wallet/constants";
export * from "@/lib/wallet/Errors";
export { walletLogger } from "@/lib/wallet/logger";

export {
  resolvePreferredConnector,
  rememberConnectorId,
  clearRememberedConnectorId,
  getPreferredConnectorForHost,
} from "@/lib/wallet/ConnectorResolver";

export {
  detectCapabilities,
  resolveProviderSnapshot,
  clearCapabilityCache,
} from "@/lib/wallet/ProviderResolver";

export {
  ensureChain,
  ensureBaseMainnetChain,
  getActiveChainId,
  isSwitchRejectedError,
} from "@/lib/wallet/ChainManager";

export {
  getConnectedAddress,
  getActiveConnector,
  getHostWalletRequestClient,
  getHostWalletClient,
  getHostPublicClient,
  requireConnectedAddress,
  waitForHostTransactionReceipt,
  getHostTransactionReceipt,
  readHostContract,
  estimateHostGas,
} from "@/lib/wallet/WalletClient";

export {
  executeCalls,
  executeWriteContract,
  executeDeployContract,
  collectDeployWalletDiagnostics,
} from "@/lib/wallet/TransactionManager";

export {
  connectPreferredWallet,
  disconnectWallet,
  reconnectWallet,
  getWalletAddress,
  getWalletConnectionStatus,
} from "@/lib/wallet/WalletManager";

export { resolveHostFromConfig } from "@/lib/wallet/resolveHostFromConfig";

export {
  WalletHostProvider,
  useWalletHost,
} from "@/lib/wallet/WalletHostContext";
