// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * BaseQuest Builder Badge — one mint per wallet.
 */
contract BaseQuestBadge is ERC721 {
  uint256 private _nextTokenId = 1;
  mapping(address => bool) public hasMinted;

  error AlreadyMinted();

  constructor() ERC721("BaseQuest Builder Badge", "BQB") {}

  /**
   * Claim a single badge NFT for the caller.
   * Reverts if the wallet has already minted.
   */
  function claim() external returns (uint256 tokenId) {
    if (hasMinted[msg.sender]) {
      revert AlreadyMinted();
    }

    hasMinted[msg.sender] = true;
    tokenId = _nextTokenId;
    unchecked {
      _nextTokenId = tokenId + 1;
    }

    _safeMint(msg.sender, tokenId);
  }

  /**
   * Placeholder metadata URI for every token (replace later).
   */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    _requireOwned(tokenId);
    return "ipfs://placeholder/basequest-builder-badge.json";
  }
}
