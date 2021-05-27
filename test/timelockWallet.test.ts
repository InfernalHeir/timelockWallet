import { ethers, waffle } from "hardhat";
import chai, { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import _ from "lodash";
import { Contract } from "@ethersproject/contracts";
import { formatUnits } from "@ethersproject/units";

const { solidity } = waffle;
chai.use(solidity);

describe("Timlock Wallet Contract Functionalities", () => {
  var owner: SignerWithAddress;
  var alice: SignerWithAddress;

  var timelock: Contract;

  // mock tokens
  var UFARM: Contract;
  var ORO: Contract;

  var ADDRESS_ZERO: string = "0x0000000000000000000000000000000000000000";

  before(async () => {
    // grab the signers
    var [ownerSigner, aliceSigner] = await ethers.getSigners();
    owner = ownerSigner;
    alice = aliceSigner;

    // deploy the timelock wallet contract
    const factory = await ethers.getContractFactory("TimelockWallet");

    // deploy contract
    const lockingPeriod = _.multiply(86400, 10);
    const TimeLock = await factory.connect(owner).deploy(lockingPeriod);

    // wait for deplyment
    timelock = TimeLock;

    // deploy mock contract as well
    const MockERC20 = await ethers.getContractFactory("MOCKERC20");
    const supply = ethers.utils.parseUnits("5000", "ether");

    const oro = await MockERC20.connect(owner).deploy(
      "OpenDefi by OroPocket",
      "ORO",
      supply
    );
    const ufarm = await MockERC20.connect(owner).deploy(
      "Unifarm Token",
      "UFARM",
      ethers.utils.parseUnits("7500", "ether")
    );

    ORO = oro;
    UFARM = ufarm;
  });

  describe("Lock Token Functionality", () => {
    it("token can be locked by only owner", async () => {
      const tokens = ethers.utils.parseUnits("5000", "ether");
      await expect(
        timelock.connect(alice).lockToken(UFARM.address, tokens)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("lock token should be revert on zero address", async () => {
      const tokens = ethers.utils.parseUnits("5000", "ether");
      await expect(
        timelock.connect(owner).lockToken(ADDRESS_ZERO, tokens)
      ).to.be.revertedWith("TimelockWallet: invalid address");
    });

    it("token amount should be greater than zero", async () => {
      await expect(
        timelock.connect(owner).lockToken(UFARM.address, 0)
      ).to.be.revertedWith("TimelockWallet: invalid amount");
    });

    it("token locked failed on without approval", async () => {
      const tokens = ethers.utils.parseUnits("5000", "ether");
      await expect(
        timelock.connect(owner).lockToken(UFARM.address, tokens)
      ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("check the tokensLocked", async () => {
      expect(await timelock.tokens(UFARM.address)).to.be.equal(0);
    });

    it("lock the UFARM Token", async () => {
      const tokens = ethers.utils.parseUnits("5000", "ether");
      await UFARM.connect(owner).approve(timelock.address, tokens);
      await expect(
        timelock.connect(owner).lockToken(UFARM.address, tokens)
      ).to.be.emit(timelock, "TokenLocked");
    });

    it("lock the ORO Token", async () => {
      const tokens = ethers.utils.parseUnits("5000", "ether");
      await ORO.connect(owner).approve(timelock.address, tokens);
      await expect(
        timelock.connect(owner).lockToken(ORO.address, tokens)
      ).to.be.emit(timelock, "TokenLocked");
    });
  });

  describe("Read only functions", () => {
    it("increase the evm time for 1 hours", async () => {
      await ethers.provider.send("evm_increaseTime", [3600]);
    });

    it("startTime should be less than unlockTime", async () => {
      const startTime = await timelock.startTime();
      const unlockTime = await timelock.unlockTime();
      expect(Number(startTime)).to.be.lessThan(Number(unlockTime));
    });

    it("unlockTime should be correct", async () => {
      const startTime = await timelock.startTime();
      const gracePeriod = _.multiply(10, 86400);

      const expectedUnlockDuration = _.add(Number(startTime), gracePeriod);
      const unlockTime = await timelock.unlockTime();
      expect(expectedUnlockDuration).to.be.equal(Number(unlockTime));
    });

    it("contract hold 5000 ORO tokens", async () => {
      const balance = await ORO.balanceOf(timelock.address);
      const formattedBalance = Number(formatUnits(String(balance), "ether"));
      expect(formattedBalance).to.be.equal(5000);
    });

    it("contract hold 5000 UFARM tokens as well", async () => {
      const balance = await UFARM.balanceOf(timelock.address);
      const formattedBalance = Number(formatUnits(String(balance), "ether"));
      expect(formattedBalance).to.be.equal(5000);
    });

    it("owner hold 0 ORO tokens", async () => {
      const balance = await ORO.balanceOf(owner.address);
      const formattedBalance = Number(formatUnits(String(balance), "ether"));
      expect(formattedBalance).to.be.equal(0);
    });

    it("owner hold 2500 UFARM tokens which is remaining to locked", async () => {
      const balance = await UFARM.balanceOf(owner.address);
      const formattedBalance = Number(formatUnits(String(balance), "ether"));
      expect(formattedBalance).to.be.equal(2500);
    });

    it("have manage the state of locked ORO tokens", async () => {
      const lockTokens = await timelock.tokens(ORO.address);
      const formattedLockedBalance = Number(
        formatUnits(String(lockTokens), "ether")
      );
      expect(formattedLockedBalance).to.be.equal(5000);
    });

    it("have manage the state of locked UFARM tokens", async () => {
      const lockTokens = await timelock.tokens(UFARM.address);
      const formattedLockedBalance = Number(
        formatUnits(String(lockTokens), "ether")
      );
      expect(formattedLockedBalance).to.be.equal(5000);
    });
  });

  describe("Misllenious functionalities", () => {
    it("lock the UFARM Token repeat", async () => {
      const tokens = ethers.utils.parseUnits("2500", "ether");
      await UFARM.connect(owner).approve(timelock.address, tokens);
      await expect(
        timelock.connect(owner).lockToken(UFARM.address, tokens)
      ).to.be.emit(timelock, "TokenLocked");
    });

    it("contract hold 7500 UFARM tokens as well", async () => {
      const balance = await UFARM.balanceOf(timelock.address);
      const formattedBalance = Number(formatUnits(String(balance), "ether"));
      expect(formattedBalance).to.be.equal(7500);
    });

    it("have manage the state of locked UFARM tokens", async () => {
      const lockTokens = await timelock.tokens(UFARM.address);
      const formattedLockedBalance = Number(
        formatUnits(String(lockTokens), "ether")
      );
      expect(formattedLockedBalance).to.be.equal(7500);
    });

    it("now owner have zero UFARM Tokens", async () => {
      const balance = await UFARM.balanceOf(owner.address);
      const formattedBalance = Number(formatUnits(String(balance), "ether"));
      expect(formattedBalance).to.be.equal(0);
    });
  });

  describe("Unlocking Functionalities", () => {
    it("safeWithdraw only called by owner", async () => {
      await expect(
        timelock.connect(alice).safeWithdraw(UFARM.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("will santize the inputs", async () => {
      await expect(
        timelock.connect(owner).safeWithdraw(ADDRESS_ZERO)
      ).to.be.revertedWith("TimelockWallet: invalid address");
    });

    it("owner try on between locking duration", async () => {
      await expect(
        timelock.connect(owner).safeWithdraw(UFARM.address)
      ).to.be.revertedWith("TimelockWallet: tokens locked");
    });

    it("owner can be reverted if he puts zero as a locking period", async () => {
      await expect(
        timelock.connect(owner).updateUnlockTime(0)
      ).to.be.revertedWith(
        "TimelockWallet: durantion should be greater than zero"
      );
    });

    it("owner can adjust unlocktime accordingly", async () => {
      const period = _.multiply(5, 86400);
      await timelock.connect(owner).updateUnlockTime(period);
    });

    it("Adjust time for 5 days", async () => {
      const unlockingPeriod = _.multiply(5, 86400);
      await ethers.provider.send("evm_increaseTime", [unlockingPeriod]);
    });

    it("have check the unlockTime because we update it for 5 days", async () => {
      const startTime = await timelock.startTime();
      const gracePeriod = _.multiply(5, 86400);

      const expectedUnlockDuration = _.add(Number(startTime), gracePeriod);
      const unlockTime = await timelock.unlockTime();
      expect(expectedUnlockDuration).to.be.equal(Number(unlockTime));
    });

    it("owner again tries for UFARM Withdrawal", async () => {
      await expect(
        timelock.connect(owner).safeWithdraw(UFARM.address)
      ).to.be.emit(timelock, "Withdraw");
    });

    it("contract hold 0 UFARM tokens now", async () => {
      const balance = await UFARM.balanceOf(timelock.address);
      const formattedBalance = Number(formatUnits(String(balance), "ether"));
      expect(formattedBalance).to.be.equal(0);
    });

    it("owner have 7500 UFARM which withdrawaled from timelock", async () => {
      const balance = await UFARM.balanceOf(owner.address);
      const formattedBalance = Number(formatUnits(String(balance), "ether"));
      expect(formattedBalance).to.be.equal(7500);
    });

    it("state Updated", async () => {
      const lockTokens = await timelock.tokens(UFARM.address);
      const formattedLockedBalance = Number(
        formatUnits(String(lockTokens), "ether")
      );
      expect(formattedLockedBalance).to.be.equal(0);
    });

    it("double retry by owner but contract have no balance it will definitely revert", async () => {
      await expect(
        timelock.connect(owner).safeWithdraw(UFARM.address)
      ).to.be.revertedWith("TimelockWallet: tokens not withdrawble");
    });
  });

  describe("Dual OwnerShip Funcitonality", () => {
    it("owner will be the admin", async () => {
      expect(await timelock._admin()).to.be.equal(owner.address);
    });

    it("Admin can transafer Ownership", async () => {
      await expect(timelock.connect(owner).transferOwnership(alice.address))
        .to.be.emit(timelock, "OwnershipTransferred")
        .withArgs(owner.address, alice.address);
    });

    it("alice is the contract owner", async () => {
      expect(await timelock.owner()).to.be.equal(alice.address);
    });

    it("only Admin can call renounceOwnership even if real Owner cannot able to call", async () => {
      await expect(
        timelock.connect(alice).renounceOwnership()
      ).to.be.revertedWith("Ownable: caller is not the admin");
    });

    it("Admin can renounceOwnership", async () => {
      await expect(timelock.connect(owner).renounceOwnership())
        .to.be.emit(timelock, "OwnershipTransferred")
        .withArgs(alice.address, owner.address);
    });

    it("will give me right owner", async () => {
      expect(await timelock.owner()).to.be.equal(owner.address);
    });
  });
});
