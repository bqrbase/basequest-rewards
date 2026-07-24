/**
 * Deployment entrypoints for Deploy Contract templates.
 */

export {
  deployHelloBase,
  getBaseScanAddressUrl,
  type HelloBaseDeployFailure,
  type HelloBaseDeployParams,
  type HelloBaseDeployResult,
  type HelloBaseDeploySuccess,
} from "@/lib/contracts/deploy/helloBase";

export type DeployTemplateId = "hello-base";

export type DeployPlaceholderResult = {
  ok: false;
  status: "not_implemented" | "error";
  message: string;
};

/**
 * Route a template id to its deploy implementation.
 */
export async function deployContractTemplate(
  templateId: DeployTemplateId | string,
  params?: Parameters<
    typeof import("@/lib/contracts/deploy/helloBase").deployHelloBase
  >[0],
): Promise<
  | import("@/lib/contracts/deploy/helloBase").HelloBaseDeployResult
  | DeployPlaceholderResult
> {
  if (templateId === "hello-base") {
    if (!params) {
      return {
        ok: false,
        status: "error",
        message: "Missing deploy params for HelloBase.",
      };
    }

    const { deployHelloBase } = await import(
      "@/lib/contracts/deploy/helloBase"
    );
    return deployHelloBase(params);
  }

  return {
    ok: false,
    status: "not_implemented",
    message: `Deployment for template "${templateId}" is not implemented yet.`,
  };
}
