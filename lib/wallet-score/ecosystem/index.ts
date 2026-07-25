export {
  analyzeBaseEcosystem,
  computeEcosystemScoreContribution,
} from "@/lib/wallet-score/ecosystem/analyzeBaseEcosystem";
export {
  BASE_PROTOCOL_BY_ADDRESS,
  normalizeContractAddress,
  resolveBaseProtocol,
  resolveBaseProtocolFromHints,
} from "@/lib/wallet-score/ecosystem/protocols";
export type { BaseProtocolResolveHints } from "@/lib/wallet-score/ecosystem/protocols";
export type {
  BaseEcosystemAnalysis,
  BaseEcosystemAnalysisInput,
  EcosystemProtocolHit,
} from "@/lib/wallet-score/ecosystem/types";
