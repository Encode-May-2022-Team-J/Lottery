// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {LotteryToken} from "./Token.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Lottery is Ownable {
    bool internal _betsOpen;
    uint256 public betsClosingTime;

    modifier whenBetsClosed() {
        require(!_betsOpen, "Lottery is open");
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
}
