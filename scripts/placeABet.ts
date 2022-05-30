import { ethers } from "hardhat";
import * as readline from "readline";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// eslint-disable-next-line node/no-missing-import
import { Lottery, LotteryToken } from "../typechain";
import { Contract } from "ethers";
import dotenv from "dotenv";
dotenv.config()

let contract: Lottery;
let token: LotteryToken;
let accounts: SignerWithAddress[];

const BET_PRICE = 1;
const BET_FEE = 0.2;

async function main() {
  await initContracts();
  await initAccounts();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  mainMenu(rl);
}

async function initContracts() {
  const contractFactory = await ethers.getContractFactory("Lottery");
  contract = await contractFactory.deploy(
    "LotteryToken",
    "LT0",
    1,
    ethers.utils.parseEther(BET_PRICE.toFixed(18)),
    ethers.utils.parseEther(BET_FEE.toFixed(18))
  );
  await contract.deployed();
  const tokenAddress = await contract.paymentToken();
  const tokenFactory = await ethers.getContractFactory("LotteryToken");
  token = tokenFactory.attach(tokenAddress);
}

async function initAccounts() {
  accounts = await ethers.getSigners();
}

async function mainMenu(rl: readline.Interface) {
  menuOptions(rl);
}

function menuOptions(rl: readline.Interface) {
  rl.question(
    "Select operation: \n Options: \n [0]: Exit \n [1]: Check state \n [2]: Open bets \n [3]: Top up account tokens \n [4]: Bet with account \n [5]: Set seed & close bets \n [6]: Reveal seed and draw winner \n [7]: Check player prize \n [8]: Withdraw \n [9]: Burn tokens \n [10]: Set trusted party \n",
    async (answer: string) => {
      console.log(`Selected: ${answer}\n`);
      const option = Number(answer);
      switch (option) {
        case 0:
          rl.close();
          return;
        case 1:
          await checkState();
          mainMenu(rl);
          break;
        case 2:
          rl.question("Input duration (in seconds)\n", async (duration: string) => {
            try {
              await openBets(duration);
            } catch (error) {
              console.log("error\n");
              console.log({ error });
            }
            mainMenu(rl);
          });
          break;
        case 3:
          rl.question("What account (index) to use?\n", async (index: string) => {
            await displayBalance(index);
            rl.question("Buy how many tokens?\n", async (amount: string) => {
              try {
                await buyTokens(index, amount);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
          });
          break;
        case 4:
          rl.question("What account (index) to use?\n", async (index: string) => {
            await displayTokenBalance(index);
            rl.question("Bet how many times?\n", async (amount: string) => {
              try {
                await bet(index, amount);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
          });
          break;
        case 5:
          rl.question("What random seed to use?\n", async (seed: string) =>{
            try {
              await setSealedSeed(accounts[0].address, seed);
            } catch (error) {
              console.log("error\n");
              console.log({ error });
            }
            mainMenu(rl);
          });
          break;
        case 6:
            rl.question("What was random seed?\n", async (seed: string) =>{
              try {
                await reveal(seed);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
            break;
        case 7:
          rl.question("What account (index) to use?\n", async (index: string) => {
            const prize = await displayPrize(index);
            if (Number(prize) > 0) {
              rl.question(
                "Do you want to claim your prize? [Y/N]\n",
                async (answer) => {
                  if (answer.toLowerCase() === "y") {
                    try {
                      await claimPrize(index, prize);
                    } catch (error) {
                      console.log("error\n");
                      console.log({ error });
                    }
                  }
                  mainMenu(rl);
                }
              );
            } else {
              mainMenu(rl);
            }
          });
          break;
        case 8:
          await displayTokenBalance("0");
          await displayOwnerPool();
          rl.question("Withdraw how many tokens?\n", async (amount: string) => {
            try {
              await withdrawTokens(amount);
            } catch (error) {
              console.log("error\n");
              console.log({ error });
            }
            mainMenu(rl);
          });
          break;
        case 9:
          rl.question("What account (index) to use?\n", async (index: string) => {
            await displayTokenBalance(index);
            rl.question("Burn how many tokens?\n", async (amount: string) => {
              try {
                await burnTokens(index, amount);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
          });
          break;
          case 10:
            rl.question(`What address?\n account[0] = ${accounts[0].address} \n account[1] = ${accounts[1].address} \n`, async (address: string) =>{
              try {
                await setTrustedParty(address);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
            break;
        default:
          throw new Error("Invalid option");
      }
    }
  );
}

async function checkState() {
  const state = await contract.betsOpen();
  console.log(`The lottery is ${state ? "open" : "closed"}\n`);
  const currentBlock = await ethers.provider.getBlock("latest");
  if (!state) return;
  const currentBlockDate = new Date(currentBlock.timestamp * 1000);
  const closingTime = await contract.betsClosingTime();
  const closingTimeDate = new Date(closingTime.toNumber() * 1000);
  console.log(
    `The last block was mined at ${currentBlockDate.toLocaleDateString()} : ${currentBlockDate.toLocaleTimeString()}`
  );
  console.log(
    `lottery should close at ${closingTimeDate.toLocaleDateString()} : ${closingTimeDate.toLocaleTimeString()}`
  );
}

async function openBets(duration: string) {
  const currentBlock = await ethers.provider.getBlock("latest");
  const tx = await contract.openBets(currentBlock.timestamp + Number(duration));
  const receipt = await tx.wait();
  console.log(`Bets are opened (${receipt.transactionHash})`);
}

async function displayBalance(index: string) {
  const balanceBN = await ethers.provider.getBalance(
    accounts[Number(index)].address
  );
  const balance = ethers.utils.formatEther(balanceBN);
  console.log(
    `The account of address ${
      accounts[Number(index)].address
    } has ${balance} ETH\n`
  );
}

async function buyTokens(index: string, amount: string) {
  const tx = await contract
    .connect(accounts[Number(index)])
    .purchaseTokens({ value: ethers.utils.parseEther(amount) });
  const receipt = await tx.wait();
  console.log(`Tokens bought (${receipt.transactionHash})\n`);
}

async function displayTokenBalance(index: string) {
  const balanceBN = await token.balanceOf(accounts[Number(index)].address);
  const balance = ethers.utils.formatEther(balanceBN);
  console.log(
    `The account of address ${
      accounts[Number(index)].address
    } has ${balance} Tokens\n`
  );
}

async function bet(index: string, amount: string) {
  const allowTx = await token
    .connect(accounts[Number(index)])
    .approve(contract.address, ethers.constants.MaxUint256);
  await allowTx.wait();
  const tx = await contract.connect(accounts[Number(index)]).betMany(amount);
  const receipt = await tx.wait();
  console.log(`Bets placed (${receipt.transactionHash})\n`);
}

async function setSealedSeed(trustedAddress:string, seed: string) {
  const abiCoder = ethers.utils.defaultAbiCoder
  const encoded = abiCoder.encode([ "address", "bytes32" ], [ trustedAddress, ethers.utils.formatBytes32String(seed) ]);
  const tx = await contract.setSealedSeed(ethers.utils.keccak256(encoded));
  const receipt = await tx.wait();
  console.log(`Sealed seed has been set and bets are closed (${receipt.transactionHash})\n`);
}

async function reveal(seed: string) {
  const tx = await contract.reveal(ethers.utils.formatBytes32String(seed));
  const receipt = await tx.wait();
  console.log(`Random seed revealed and winners calculated (${receipt.transactionHash})\n`);
}

async function displayPrize(index: string): Promise<string> {
  const prizeBN = await contract.prize(accounts[Number(index)].address);
  const prize = ethers.utils.formatEther(prizeBN);
  console.log(
    `The account of address ${
      accounts[Number(index)].address
    } has earned a prize of ${prize} Tokens\n`
  );
  return prize;
}

async function claimPrize(index: string, amount: string) {
  const tx = await contract
    .connect(accounts[Number(index)])
    .prizeWithdraw(ethers.utils.parseEther(amount));
  const receipt = await tx.wait();
  console.log(`Prize claimed (${receipt.transactionHash})\n`);
}

async function displayOwnerPool() {
  const balanceBN = await contract.ownerPool();
  const balance = ethers.utils.formatEther(balanceBN);
  console.log(`The owner pool has (${balance}) Tokens\n`);
}

async function withdrawTokens(amount: string) {
  const tx = await contract.ownerWithdraw(ethers.utils.parseEther(amount));
  const receipt = await tx.wait();
  console.log(`Withdraw confirmed (${receipt.transactionHash})\n`);
}

async function burnTokens(index: string, amount: string) {
  const tx = await contract
    .connect(accounts[Number(index)])
    .returnTokens(ethers.utils.parseEther(amount));
  const receipt = await tx.wait();
  console.log(`Burn confirmed (${receipt.transactionHash})\n`);
}

async function setTrustedParty(address: string) {
  const tx = await contract.setTrustedParty(address);
  const receipt = await tx.wait();
  console.log(`Trusted party address has been updated (${receipt.transactionHash})\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
