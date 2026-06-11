// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IEmojiToken {
    function mint(address to, uint256 amount) external;
}

contract EmojiClaim is EIP712, Ownable {
    struct Claim {
        address wallet;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address wallet,uint256 amount,uint256 nonce,uint256 deadline)");
    uint256 public constant MAX_CLAIMABLE_SUPPLY = 9_900_000_000 ether;

    IEmojiToken public immutable emojiToken;
    address public claimSigner;
    uint256 public totalClaimed;

    mapping(bytes32 => bool) public usedClaims;

    event ClaimSignerUpdated(address indexed signer);
    event EmojiClaimed(address indexed wallet, uint256 amount, uint256 nonce, bytes32 claimHash);

    constructor(address token, address signer, address owner) EIP712("DOPAMINE Claim", "1") Ownable(owner) {
        require(token != address(0), "DOPAMINE: token required");
        require(signer != address(0), "DOPAMINE: signer required");
        emojiToken = IEmojiToken(token);
        claimSigner = signer;
    }

    function setClaimSigner(address signer) external onlyOwner {
        require(signer != address(0), "DOPAMINE: signer required");
        claimSigner = signer;
        emit ClaimSignerUpdated(signer);
    }

    function claim(Claim calldata claimData, bytes calldata signature) external {
        require(block.timestamp <= claimData.deadline, "DOPAMINE: claim expired");
        require(claimData.wallet == msg.sender, "DOPAMINE: wrong wallet");
        require(totalClaimed + claimData.amount <= MAX_CLAIMABLE_SUPPLY, "DOPAMINE: claim cap exceeded");

        bytes32 claimHash = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CLAIM_TYPEHASH,
                    claimData.wallet,
                    claimData.amount,
                    claimData.nonce,
                    claimData.deadline
                )
            )
        );

        require(!usedClaims[claimHash], "DOPAMINE: claim already used");
        require(ECDSA.recover(claimHash, signature) == claimSigner, "DOPAMINE: bad signature");

        usedClaims[claimHash] = true;
        totalClaimed += claimData.amount;
        emojiToken.mint(claimData.wallet, claimData.amount);

        emit EmojiClaimed(claimData.wallet, claimData.amount, claimData.nonce, claimHash);
    }
}
