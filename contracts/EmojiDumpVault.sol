// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IEmojiStakingVault {
    function stakedBalanceOf(address account) external view returns (uint256);
}

contract EmojiDumpVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Epoch {
        uint64 startsAt;
        uint64 endsAt;
        uint256 totalDumped;
        uint256 prizePaid;
        address winner;
        bool settled;
        uint256 totalTickets;
    }

    uint64 public constant EPOCH_DURATION = 3 hours;

    IERC20 public immutable emojiToken;
    IEmojiStakingVault public immutable stakingVault;

    uint256 public currentEpochId;
    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(address => uint256)) public dumpedByEpoch;
    mapping(uint256 => mapping(address => uint256)) public ticketsByEpoch;
    mapping(uint256 => address[]) private entrantsByEpoch;
    mapping(uint256 => mapping(address => bool)) private enteredByEpoch;

    event EpochStarted(uint256 indexed epochId, uint64 startsAt, uint64 endsAt);
    event TicketsDeposited(address indexed account, uint256 indexed epochId, uint256 amount);
    event Dumped(address indexed account, uint256 indexed epochId, uint256 amount);
    event EpochSettled(uint256 indexed epochId, address indexed winner, uint256 prizePaid);

    constructor(address token, address staking) {
        require(token != address(0), "DOPAMINE: token required");
        require(staking != address(0), "DOPAMINE: staking required");

        emojiToken = IERC20(token);
        stakingVault = IEmojiStakingVault(staking);
        _startNextEpoch();
    }

    function entrants(uint256 epochId) external view returns (address[] memory) {
        return entrantsByEpoch[epochId];
    }

    function depositTickets(uint256 amount) external nonReentrant {
        require(amount > 0, "DOPAMINE: zero tickets");
        _rolloverIfNeeded();

        uint256 existingTickets = ticketsByEpoch[currentEpochId][msg.sender];
        require(
            existingTickets + amount <= stakingVault.stakedBalanceOf(msg.sender),
            "DOPAMINE: tickets exceed stake"
        );

        if (!enteredByEpoch[currentEpochId][msg.sender]) {
            enteredByEpoch[currentEpochId][msg.sender] = true;
            entrantsByEpoch[currentEpochId].push(msg.sender);
        }

        ticketsByEpoch[currentEpochId][msg.sender] = existingTickets + amount;
        epochs[currentEpochId].totalTickets += amount;

        emit TicketsDeposited(msg.sender, currentEpochId, amount);
    }

    function dump(uint256 amount) external nonReentrant {
        require(amount > 0, "DOPAMINE: zero dump");
        _rolloverIfNeeded();

        epochs[currentEpochId].totalDumped += amount;
        dumpedByEpoch[currentEpochId][msg.sender] += amount;
        emojiToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Dumped(msg.sender, currentEpochId, amount);
    }

    function rollover() external nonReentrant {
        require(block.timestamp >= epochs[currentEpochId].endsAt, "DOPAMINE: epoch active");
        _settleCurrentEpoch();
        _startNextEpoch();
    }

    function _rolloverIfNeeded() internal {
        if (block.timestamp >= epochs[currentEpochId].endsAt) {
            _settleCurrentEpoch();
            _startNextEpoch();
        }
    }

    function _startNextEpoch() internal {
        currentEpochId += 1;
        uint64 startsAt = uint64(block.timestamp);
        uint64 endsAt = startsAt + EPOCH_DURATION;
        epochs[currentEpochId] = Epoch({
            startsAt: startsAt,
            endsAt: endsAt,
            totalDumped: 0,
            prizePaid: 0,
            winner: address(0),
            settled: false,
            totalTickets: 0
        });

        emit EpochStarted(currentEpochId, startsAt, endsAt);
    }

    function _settleCurrentEpoch() internal {
        Epoch storage epoch = epochs[currentEpochId];
        if (epoch.settled) return;

        epoch.settled = true;

        if (epoch.totalDumped == 0 || epoch.totalTickets == 0) {
            emit EpochSettled(currentEpochId, address(0), 0);
            return;
        }

        address winner = _pickWinner(currentEpochId, epoch.totalTickets);
        epoch.winner = winner;
        epoch.prizePaid = epoch.totalDumped;
        emojiToken.safeTransfer(winner, epoch.totalDumped);

        emit EpochSettled(currentEpochId, winner, epoch.totalDumped);
    }

    function _pickWinner(uint256 epochId, uint256 totalTickets) internal view returns (address) {
        uint256 winningTicket = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    blockhash(block.number - 1),
                    address(this),
                    epochId,
                    totalTickets,
                    epochs[epochId].totalDumped
                )
            )
        ) % totalTickets;

        uint256 cursor = 0;
        address[] storage entrantsForEpoch = entrantsByEpoch[epochId];
        for (uint256 index = 0; index < entrantsForEpoch.length; index++) {
            address entrant = entrantsForEpoch[index];
            cursor += ticketsByEpoch[epochId][entrant];
            if (winningTicket < cursor) {
                return entrant;
            }
        }

        return entrantsForEpoch[entrantsForEpoch.length - 1];
    }
}
