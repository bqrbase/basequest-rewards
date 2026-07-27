import {
  encodePacked,
  keccak256,
  type Address,
  type Hex,
} from "viem";

/** Match OpenZeppelin `Hashes.commutativeKeccak256` (sorted pair). */
export function hashPair(a: Hex, b: Hex): Hex {
  return a.toLowerCase() < b.toLowerCase()
    ? keccak256(encodePacked(["bytes32", "bytes32"], [a, b]))
    : keccak256(encodePacked(["bytes32", "bytes32"], [b, a]));
}

/** Match RewardsDistributor `_claimLeaf` (no campaignId). */
export function claimLeaf(params: {
  account: Address;
  rewardId: Hex;
  amount: bigint;
}): Hex {
  return keccak256(
    encodePacked(
      ["address", "bytes32", "uint256"],
      [params.account, params.rewardId, params.amount],
    ),
  );
}

/**
 * Build a Merkle tree over `leaves` using OZ-sorted pairwise hashing.
 * Returns root and per-leaf proofs (same order as `leaves`).
 */
export function buildMerkleTree(leaves: Hex[]): {
  root: Hex;
  proofs: Hex[][];
} {
  if (leaves.length === 0) {
    throw new Error("buildMerkleTree: empty leaves");
  }

  // Single-leaf tree: root is the leaf; proof is empty.
  if (leaves.length === 1) {
    return { root: leaves[0], proofs: [[]] };
  }

  type Node = { hash: Hex; leafIndex?: number };
  let level: Node[] = leaves.map((hash, leafIndex) => ({ hash, leafIndex }));

  // parent[childHash] = { sibling, parentHash } for proof reconstruction
  const parentOf = new Map<Hex, { sibling: Hex; parent: Hex }>();

  while (level.length > 1) {
    if (level.length % 2 === 1) {
      level = [...level, level[level.length - 1]];
    }
    const next: Node[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1];
      const parentHash = hashPair(left.hash, right.hash);
      parentOf.set(left.hash, { sibling: right.hash, parent: parentHash });
      // Only record the right child edge when hashes differ (avoid dup-pad noise).
      if (left.hash.toLowerCase() !== right.hash.toLowerCase()) {
        parentOf.set(right.hash, { sibling: left.hash, parent: parentHash });
      }
      next.push({ hash: parentHash });
    }
    level = next;
  }

  const root = level[0].hash;
  const proofs: Hex[][] = leaves.map((leaf) => {
    const proof: Hex[] = [];
    let current = leaf;
    while (current.toLowerCase() !== root.toLowerCase()) {
      const edge = parentOf.get(current);
      if (!edge) {
        throw new Error("buildMerkleTree: incomplete tree walk");
      }
      proof.push(edge.sibling);
      current = edge.parent;
    }
    return proof;
  });

  return { root, proofs };
}
