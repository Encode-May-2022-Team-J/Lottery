// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {LotteryToken} from "./Token.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Lottery is Ownable {
    /// @notice Address of the token used as payment for the bets
    LotteryToken public paymentToken;
    /// @notice Amount of ETH charged per Token purchased
    uint256 public purchaseRatio;
    /// @notice Amount of tokens required for placing a bet that goes for the prize pool
    uint256 public betPrice;
    /// @notice Amount of tokens required for placing a bet that goes for the owner pool
    uint256 public betFee;
    /// @notice Amount of tokens in the prize pool
    uint256 public prizePool;
    /// @notice Amount of tokens in the owner pool
    uint256 public ownerPool;
    /// @notice Flag indicating if the lottery is open for bets
    bool public betsOpen;
    /// @notice Timestamp of the lottery next closing date
    uint256 public betsClosingTime;

    /// @notice random seed storage value
    bytes32 private sealedSeed;
    /// @notice Flag indicating if the seed has been set by trusted party
    bool public seedSet;
    /// @notice Stored block number of block hash to be used for random number generation
    uint256 private storedBlockNumber;
    /// @notice Address of trusted party allowed to provide random seed
    address public trustedParty = 0xb0754B937bD306fE72264274A61BC03F43FB685F;

    /// @notice Mapping of prize available for withdraw for each account
    mapping(address => uint256) public prize;

    /// @dev List of bet slots
    address[] _slots;

    /// @notice Constructor function
    /// @param tokenName Name of the token used for payment
    /// @param tokenSymbol Symbol of the token used for payment
    /// @param _purchaseRatio Amount of ETH charged per Token purchased
    /// @param _betPrice Amount of tokens required for placing a bet that goes for the prize pool
    /// @param _betFee Amount of tokens required for placing a bet that goes for the owner pool
    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint256 _purchaseRatio,
        uint256 _betPrice,
        uint256 _betFee
    ) {
        paymentToken = new LotteryToken(tokenName, tokenSymbol);
        purchaseRatio = _purchaseRatio;
        betPrice = _betPrice;
        betFee = _betFee;
    }

    /// @notice Passes when the lottery is at closed state
    modifier whenBetsClosed() {
        require(!betsOpen, "Lottery is open");
        _;
    }

    /// @notice Passes when the lottery is at open state and the current block timestamp is lower than the lottery closing date
    modifier whenBetsOpen() {
        require(
            betsOpen && block.timestamp < betsClosingTime,
            "Lottery is closed"
        );
        _;
    }

    function setTrustedParty(address _trustedAddress) public payable {
        trustedParty = _trustedAddress;
    }

    function setSealedSeed(bytes32 _sealedSeed) public {
        require(block.timestamp >= betsClosingTime, "Too soon to close");
        require(betsOpen, "Already closed");
        require (msg.sender == trustedParty, "Address not qualified!");
        require(!seedSet, "Seed already set!");
        betsOpen = false;
        sealedSeed = _sealedSeed;
        storedBlockNumber = block.number + 1;
        seedSet = true;
    }


    /// @notice Open the lottery for receiving bets
    function openBets(uint256 closingTime) public onlyOwner whenBetsClosed {
        require(
            closingTime > block.timestamp,
            "Closing time must be in the future"
        );
        require(!seedSet, "random seed must not be set before opening bets");
        betsClosingTime = closingTime;
        betsOpen = true;
    }

    /// @notice Give tokens based on the amount of ETH sent
    function purchaseTokens() public payable {
        paymentToken.mint(msg.sender, msg.value / purchaseRatio);
    }

    /// @notice Charge the bet price and create a new bet slot with the sender address
    function bet() public whenBetsOpen {
        paymentToken.transferFrom(msg.sender, address(this), betPrice + betFee);
        ownerPool += betFee;
        prizePool += betPrice;
        _slots.push(msg.sender);
    }

    /// @notice Call the bet function `times` times
    function betMany(uint256 times) public {
        require(times > 0);
        uint256 localPrizePool = prizePool;
        uint256 localOwnerPool = ownerPool;
        while (times > 0) {
            paymentToken.transferFrom(
                msg.sender,
                address(this),
                betPrice + betFee
            );
            localOwnerPool += betFee;
            localPrizePool += betPrice;
            _slots.push(msg.sender);
            times--;
        }
        prizePool = localPrizePool;
        ownerPool = localOwnerPool;
    }

    /// @notice calculate the prize
    function drawWinner(uint256 _random) private {
        if (_slots.length > 0) {
            uint256 winnerIndex = _random % _slots.length;
            address winner = _slots[winnerIndex];
            prize[winner] += prizePool;
            prizePool = 0;
            delete (_slots);
        }
    }

    // /// @notice Get a random number calculated from the block hash of last block
    // /// @dev This number could be exploited by miners
    // function getRandomNumber() public view returns (uint256 notQuiteRandomNumber) {
    //     require(seedSet, "Random seed is missing");
    //     require(!betsOpen, "Bets have to be closed");
    //     require(storedBlockNumber < block.number, "Too early");
    //     notQuiteRandomNumber = uint256(blockhash(block.number - 1));
    // }

    /// @notice reveal the random seed, create the random number and draw the winner.
    /// @dev this can only be done by someone in knowledge of the unhashed random seed
    function reveal(bytes32 _seed) public {
        require(seedSet, "Random seed not set");
        require(!betsOpen, "Bets have to be closed");
        require(storedBlockNumber < block.number, "Too early");
        require(keccak256(abi.encode(msg.sender, _seed)) == sealedSeed, "Input not matching sealed seed");
        uint256 random = uint256(keccak256(abi.encode(_seed, blockhash(storedBlockNumber))));
        drawWinner(random);     
        seedSet = false;
    }

    /// @notice Withdraw `amount` from that accounts prize pool
    function prizeWithdraw(uint256 amount) public {
        require(amount <= prize[msg.sender], "Not enough prize");
        prize[msg.sender] -= amount;
        paymentToken.transfer(msg.sender, amount);
    }

    /// @notice Withdraw `amount` from the owner pool
    function ownerWithdraw(uint256 amount) public onlyOwner {
        require(amount <= ownerPool, "Not enough fees collected");
        ownerPool -= amount;
        paymentToken.transfer(msg.sender, amount);
    }

    /// @notice Burn `amount` tokens and give the equivalent ETH back to user
    function returnTokens(uint256 amount) public {
        paymentToken.burnFrom(msg.sender, amount);
        payable(msg.sender).transfer(amount * purchaseRatio);
    }
}
