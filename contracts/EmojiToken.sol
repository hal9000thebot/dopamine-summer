// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract EmojiToken is ERC20, ERC20Capped, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY = 10_000_000_000 ether;
    uint256 public constant DEV_RESERVE_SUPPLY = 100_000_000 ether;

    constructor(address admin, address reserve) ERC20("DOPAMINE", "DOPAMINE") ERC20Capped(MAX_SUPPLY) ERC20Permit("DOPAMINE") {
        require(admin != address(0), "DOPAMINE: admin required");
        require(reserve != address(0), "DOPAMINE: reserve required");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _mint(reserve, DEV_RESERVE_SUPPLY);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Capped) {
        super._update(from, to, value);
    }
}
