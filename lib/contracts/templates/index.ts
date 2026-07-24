/**
 * Contract template registry for the Deploy Contract quest.
 * Source lives under templates/; ABIs under abi/. Deployment is not wired yet.
 */

export type ContractTemplateId = "hello-base" | "storage" | "erc20";

export type ContractTemplateDefinition = {
  id: ContractTemplateId;
  name: string;
  description: string;
  /** Relative path to Solidity source under lib/contracts/templates/ */
  sourcePath: string;
  /** Whether this template is selectable in the product UI. */
  enabled: boolean;
  comingSoon: boolean;
};

export const CONTRACT_TEMPLATES: ContractTemplateDefinition[] = [
  {
    id: "hello-base",
    name: "Hello Base",
    description:
      "A simple starter contract to deploy your first contract on Base.",
    sourcePath: "HelloBase.sol",
    enabled: true,
    comingSoon: false,
  },
  {
    id: "storage",
    name: "Storage Contract",
    description: "Store and update a value onchain.",
    sourcePath: "",
    enabled: false,
    comingSoon: true,
  },
  {
    id: "erc20",
    name: "ERC20 Token",
    description: "Deploy a basic ERC20 token on Base.",
    sourcePath: "",
    enabled: false,
    comingSoon: true,
  },
];

export function getContractTemplate(
  id: ContractTemplateId,
): ContractTemplateDefinition | undefined {
  return CONTRACT_TEMPLATES.find((template) => template.id === id);
}
