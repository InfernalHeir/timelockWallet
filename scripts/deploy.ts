import { ethers } from "hardhat";
import _ from "lodash";

async function main() {
  const [owner] = await ethers.getSigners();

  const factory = await ethers.getContractFactory("TimelockWallet");
  // deploy contract
  const unlockTime = _.multiply(90, 86400);

  const timelock = await factory.connect(owner).deploy(unlockTime);

  await timelock.deployed();

  console.log(`TimeLock Contract Address ${timelock.address}`);
}

main();
