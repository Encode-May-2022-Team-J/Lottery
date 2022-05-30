// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {LotteryToken} from "./Token.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Lottery is Ownable {
    // IERC20Token public paymentToken;
    LotteryToken public paymentToken;
    uint256 public purchaseRatio;
    uint256 public betPrice;
    uint256 public betFee;

    uint256 public prizePool;
    uint256 public ownerPool;

    bool internal _betsOpen;
    uint256 public betsClosingTime;

    mapping(address => uint256) public prize;

    address[] _slots;

    //TODO: passing in lotteryToken as parameter
    constructor(
        address _paymentToken,
        // string memory tokenName,
        // string memory tokenSymbol,
        uint256 _purchaseRatio,
        uint256 _betPrice,
        uint256 _betFee
    ) {
        // paymentToken = IERC20Token(_paymentToken);
        paymentToken = LotteryToken(_paymentToken);
        // paymentToken = new LotteryToken(tokenName, tokenSymbol);
        purchaseRatio = _purchaseRatio;
        betPrice = _betPrice;
        betFee = _betFee;
    }

    modifier whenBetsClosed() {
        require(!_betsOpen, "Lottery is open");
        _;
    }

    modifier whenBetsOpen() {
        require(
            _betsOpen && block.timestamp < betsClosingTime,
            "Lottery is closed"
        );
        _;
    }

    function betsOpen() public view returns (bool) {
        return _betsOpen;
    }

    function openBets(uint256 closingTime) public onlyOwner whenBetsClosed {
        require(
            closingTime > block.timestamp,
            "Closing time must be in the future"
        );
        betsClosingTime = closingTime;
        _betsOpen = true;
    }

    //TODO: displayBalance using index

    function purchaseTokens() public payable {
        paymentToken.mint(msg.sender, msg.value / purchaseRatio); //TODO: review this line of code
    }

    function bet() public whenBetsOpen {
        paymentToken.transferFrom(msg.sender, address(this), betPrice + betFee);
        ownerPool += betFee;
        prizePool += betPrice;
        _slots.push(msg.sender);
    }

    // TODO: review this line of code
    function betMany(uint256 times) public {
        require(times > 0);
        while (times > 0) {
            bet();
            times--;
        }
    }

    function closeLottery() public {
        require(block.timestamp >= betsClosingTime, "Too soon to close");
        require(_betsOpen, "Already closed");
        require(_slots.length > 0, "No votes");

        uint256 winnerIndex = getRandomNumber() % _slots.length;
        address winner = _slots[winnerIndex];
        prize[winner] += prizePool;
        prizePool = 0;
        delete (_slots);

        _betsOpen = false;
    }

    function getRandomNumber()
        public
        view
        returns (uint256 notQuiteRandomNumber)
    {
        notQuiteRandomNumber = uint256(blockhash(block.number - 1));
    }

    function prizeWithdraw(uint256 amount) public {
        require(amount <= prize[msg.sender], "Not enough prize");
        prize[msg.sender] -= amount;
        paymentToken.transfer(msg.sender, amount);
    }

    function ownerWithdraw(uint256 amount) public onlyOwner {
        require(amount <= ownerPool, "Not enough fees collected");
        ownerPool -= amount;
        paymentToken.transfer(msg.sender, amount);
    }

    function returnTokens(uint256 amount) public {
        paymentToken.burnFrom(msg.sender, amount);
        payable(msg.sender).transfer(amount * purchaseRatio);
    }
}
