import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// eslint-disable-next-line node/no-missing-import
import { Lottery, LotteryToken } from "../typechain";

import { BigNumber } from "ethers";

describe("Lottery", async () => {
  let contract: Lottery;
  let token: LotteryToken;
  let accounts: SignerWithAddress[];

  const BET_PRICE = 1;
  const BET_FEE = 0.2;

  beforeEach(async () => {
    const contractFactory = await ethers.getContractFactory("Lottery");
    // contract = await contractFactory.deploy(
    //   "LotteryToken",
    //   "LT0",
    //   1,
    //   ethers.utils.parseEther(BET_PRICE.toFixed(18)),
    //   ethers.utils.parseEther(BET_FEE.toFixed(18))
    // );
    contract = await contractFactory.deploy();
    await contract.deployed();
    // const tokenAddress = await contract.paymentToken();
    // const tokenFactory = await ethers.getContractFactory("LotteryToken");
    // token = tokenFactory.attach(tokenAddress);

    accounts = await ethers.getSigners();
  });

  describe("When interact with lottery state", async () => {
    it("lottery is close", async () => {
      expect(await contract.betsOpen()).eq(false);
    });

    it("open bets", async () => {
      const tx = await contract.openBets(0);
      const receipt = await tx.wait();
      console.log(`Bets opened (${receipt.transactionHash})`);
      expect(await contract.betsOpen()).eq(true);
    });

    it("open bets that has already opened", async () => {
      const tx = await contract.openBets(0);
      await tx.wait();
      expect(contract.openBets(0)).to.be.revertedWith("Lottery is open");
    });
  });
});
