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
  const TOKEN_AMOUNT = "4";

  beforeEach(async () => {
    const tokenFactory = await ethers.getContractFactory("LotteryToken");
    token = await tokenFactory.deploy("LotteryToken", "LT0");
    await token.deployed();

    const contractFactory = await ethers.getContractFactory("Lottery");
    // contract = await contractFactory.deploy(
    //   "LotteryToken",
    //   "LT0",
    //   1,
    //   ethers.utils.parseEther(BET_PRICE.toFixed(18)),
    //   ethers.utils.parseEther(BET_FEE.toFixed(18))
    // );
    // console.log(token.address);
    contract = await contractFactory.deploy(
      token.address,
      1,
      ethers.utils.parseEther(BET_PRICE.toFixed(18)),
      ethers.utils.parseEther(BET_FEE.toFixed(18))
    );
    await contract.deployed();
    // console.log(contract.address);
    // const tokenAddress = await contract.paymentToken();
    // const tokenFactory = await ethers.getContractFactory("LotteryToken");
    // token = tokenFactory.attach(tokenAddress);

    const minterRole = await token.MINTER_ROLE();
    const tx1 = await token.grantRole(minterRole, contract.address);
    await tx1.wait();

    accounts = await ethers.getSigners();
  });

  describe("When interact with lottery state", async () => {
    it("lottery is close", async () => {
      expect(await contract.betsOpen()).eq(false);
    });

    it("open bets", async () => {
      const currentBlock = await ethers.provider.getBlock("latest");
      const tx = await contract.openBets(currentBlock.timestamp + Number(10));
      const receipt = await tx.wait();
      console.log(`Bets opened (${receipt.transactionHash})`);
      expect(await contract.betsOpen()).eq(true);
    });

    it("open bets that has already opened", async () => {
      const currentBlock = await ethers.provider.getBlock("latest");
      const tx = await contract.openBets(currentBlock.timestamp + Number(10));
      await tx.wait();
      const currentBlock2 = await ethers.provider.getBlock("latest");
      expect(
        contract.openBets(currentBlock2.timestamp + Number(10))
      ).to.be.revertedWith("Lottery is open");
    });
  });

  describe("When purchasing token", async () => {
    it("purchasing 1 token", async () => {
      const acc1: SignerWithAddress = accounts[1];
      // const TOKEN_AMOUNT: string = "1";
      const tx = await contract
        .connect(acc1)
        .purchaseTokens({ value: ethers.utils.parseEther(TOKEN_AMOUNT) });
      await tx.wait();
      const balanceBN = await token.balanceOf(acc1.address);
      const diff = balanceBN.sub(ethers.utils.parseEther(TOKEN_AMOUNT));
      expect(diff).to.eq(0);
    });
  });

  describe("When doing bet", async () => {
    beforeEach(async () => {
      const acc1 = accounts[1];
      const tx = await contract
        .connect(acc1)
        .purchaseTokens({ value: ethers.utils.parseEther(TOKEN_AMOUNT) });
      await tx.wait();
      const balanceBN = await token.balanceOf(acc1.address);
      const balance = ethers.utils.formatEther(balanceBN);
      console.log(`balance: ${balance}`);

      const currentBlock = await ethers.provider.getBlock("latest");
      await contract.openBets(currentBlock.timestamp + Number(100));
    });

    it("bet 1 time", async () => {
      const price = await contract.betPrice();
      console.log(`bet price: ${price}`);
      const allowTx = await token
        .connect(accounts[1])
        .approve(contract.address, ethers.constants.MaxUint256);
      await allowTx.wait();
      await contract.connect(accounts[1]).bet();

      const prizePoolBN = await contract.prizePool();
      const diff = prizePoolBN.sub(
        ethers.utils.parseEther(BET_PRICE.toFixed(18))
      );
      expect(diff).to.eq(0);
    });

    it("bet 3 times", async () => {
      const allowTx = await token
        .connect(accounts[1])
        .approve(contract.address, ethers.constants.MaxUint256);
      await allowTx.wait();
      await contract.connect(accounts[1]).betMany(3);

      const prizePoolBN = await contract.prizePool();
      const diff = prizePoolBN.sub(
        ethers.utils.parseEther(BET_PRICE.toFixed(18)).mul(3)
      );
      expect(diff).to.eq(0);
    });
  });
});
