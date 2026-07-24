/**
 * Deploy Contract architecture root.
 *
 * lib/contracts/
 *   abi/        — contract ABIs + bytecode
 *   templates/  — Solidity sources + template registry
 *   deploy/     — client-side deploy helpers (connected wallet)
 *
 * Existing DailyCheckIn.ts remains the check-in integration module.
 */

export {
  HELLO_BASE_ABI,
  HELLO_BASE_BYTECODE,
} from "@/lib/contracts/abi/HelloBase";
export {
  CONTRACT_TEMPLATES,
  getContractTemplate,
  type ContractTemplateDefinition,
  type ContractTemplateId,
} from "@/lib/contracts/templates";
export {
  deployContractTemplate,
  deployHelloBase,
  getBaseScanAddressUrl,
  type DeployPlaceholderResult,
  type DeployTemplateId,
  type HelloBaseDeployParams,
  type HelloBaseDeployResult,
} from "@/lib/contracts/deploy";
