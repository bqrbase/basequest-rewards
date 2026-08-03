/**
 * BaseQuest client wallet layer — single entry for connect/auth/chain/tx.
 * Server auth cookies remain under lib/wallet/auth/*.
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

export { signWalletMessage } from "@/lib/wallet/Signer";

export {
  checkAuthSession,
  ensureAuthSession,
  requireAuthSession,
} from "@/lib/wallet/Authentication";

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