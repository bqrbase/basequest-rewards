/**
 * Genesis access control — single permission system for future features.
 *
 * Hooks and UI should consume `useGenesisAccess()` rather than
 * checking `isGenesisHolder` ad hoc.
 */

export { resolveGenesisAccess } from "@/lib/genesis/access/permissions";
export type {
  GenesisAccessPermissions,
  GenesisAccessState,
} from "@/lib/genesis/access/types";
