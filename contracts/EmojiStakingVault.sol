// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract EmojiStakingVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable emojiToken;

    uint256 public totalStaked;
    mapping(address => uint256) public stakedBalanceOf;

    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    constructor(address token, address owner) Ownable(owner) {
        require(token != address(0), "EmojiFi: token required");
        emojiToken = IERC20(token);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "EmojiFi: zero stake");

        stakedBalanceOf[msg.sender] += amount;
        totalStaked += amount;
        emojiToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "EmojiFi: zero withdraw");
        require(stakedBalanceOf[msg.sender] >= amount, "EmojiFi: insufficient stake");

        stakedBalanceOf[msg.sender] -= amount;
        totalStaked -= amount;
        emojiToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }
}
