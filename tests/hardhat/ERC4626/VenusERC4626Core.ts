import { FakeContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "hardhat-deploy-ethers/signers";

import {
  AccessControlManagerMock,
  ERC20,
  IComptroller,
  IProtocolShareReserve,
  MockVenusERC4626Core,
  VBep20Immutable,
} from "../../../typechain";

const { expect } = chai;
chai.use(smock.matchers);

describe("VenusERC4626Core", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let vaultOwner: SignerWithAddress;
  let venusERC4626Core: MockVenusERC4626Core;
  let asset: FakeContract<ERC20>;
  let xvs: FakeContract<ERC20>;
  let vToken: FakeContract<VBep20Immutable>;
  let comptroller: FakeContract<IComptroller>;
  let accessControlManager: FakeContract<AccessControlManagerMock>;
  let rewardRecipient: string;
  let rewardRecipientPSR: FakeContract<IProtocolShareReserve>;

  beforeEach(async () => {
    [deployer, user, vaultOwner] = await ethers.getSigners();

    // Create Smock Fake Contracts
    asset = await smock.fake<ERC20>("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
    xvs = await smock.fake<ERC20>("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
    vToken = await smock.fake<VBep20Immutable>("contracts/test/VBep20Immutable.sol:VBep20Immutable");
    comptroller = await smock.fake<IComptroller>("contracts/ERC4626/Interfaces/IComptroller.sol:IComptroller");
    accessControlManager = await smock.fake("AccessControlManagerMock");
    rewardRecipient = deployer.address;
    rewardRecipientPSR = await smock.fake<IProtocolShareReserve>(
      "contracts/ERC4626/Interfaces/IProtocolShareReserve.sol:IProtocolShareReserve",
    );

    // Configure mock behaviors
    accessControlManager.isAllowedToCall.returns(true);
    vToken.underlying.returns(asset.address);
    vToken.comptroller.returns(comptroller.address);

    // Deploy and initialize MockVenusERC4626
    const VenusERC4626Factory = await ethers.getContractFactory("MockVenusERC4626Core");

    venusERC4626Core = await upgrades.deployProxy(VenusERC4626Factory, [vToken.address], {
      initializer: "initialize",
    });

    await venusERC4626Core.initialize2(accessControlManager.address, rewardRecipient, vaultOwner.address);
  });

  describe("Initialization", () => {
    it("should deploy with correct parameters", async () => {
      expect(venusERC4626Core.address).to.not.equal(ethers.constants.AddressZero);
      expect(await venusERC4626Core.asset()).to.equal(asset.address);
      expect(await venusERC4626Core.vToken()).to.equal(vToken.address);
      expect(await venusERC4626Core.comptroller()).to.equal(comptroller.address);
      expect(await venusERC4626Core.rewardRecipient()).to.equal(rewardRecipient);
      expect(await venusERC4626Core.accessControlManager()).to.equal(accessControlManager.address);
      expect(await venusERC4626Core.owner()).to.equal(vaultOwner.address);
    });
  });

  describe("Access Control", () => {
    it("should allow authorized accounts to update reward recipient", async () => {
      const newRecipient = ethers.Wallet.createRandom().address;
      await expect(venusERC4626Core.setRewardRecipient(newRecipient))
        .to.emit(venusERC4626Core, "RewardRecipientUpdated")
        .withArgs(rewardRecipient, newRecipient);
    });
  });

  describe("Mint Operations", () => {
    const mintShares = ethers.utils.parseEther("10");
    let expectedAssets: ethers.BigNumber;

    beforeEach(async () => {
      asset.transferFrom.returns(true);
      asset.approve.returns(true);
      vToken.mint.returns(0); // NO_ERROR
      vToken.exchangeRateStored.returns(ethers.utils.parseUnits("1.0001", 18));

      await venusERC4626Core.setMaxDeposit(ethers.utils.parseUnits("100", 18)); // Sets max assets
      await venusERC4626Core.setMaxMint(ethers.utils.parseUnits("100", 18)); // Sets max shares
      await venusERC4626Core.setTotalSupply(ethers.utils.parseUnits("100", 18)); // sets total supply
      await venusERC4626Core.setTotalAssets(ethers.utils.parseUnits("100", 18)); // sets total assets

      expectedAssets = await venusERC4626Core.previewMint(mintShares);

      asset.balanceOf.returnsAtCall(0, ethers.BigNumber.from(0));
      asset.balanceOf.returnsAtCall(1, expectedAssets);

      vToken.balanceOf.returnsAtCall(0, ethers.BigNumber.from(0));
      vToken.balanceOf.returnsAtCall(1, expectedAssets);
    });

    it("should mint shares successfully", async () => {
      const tx = await venusERC4626Core.connect(user).mint(mintShares, user.address);

      const receipt = await tx.wait();
      const depositEvent = receipt.events?.find(e => e.event === "Deposit");
      const [actualCaller, actualReceiver, actualAssets, actualShares] = depositEvent?.args || [];

      expect(actualCaller).to.equal(user.address);
      expect(actualReceiver).to.equal(user.address);
      expect(actualAssets).to.be.gte(expectedAssets);
      expect(actualShares).to.be.gte(mintShares);

      expect(vToken.mint).to.have.been.calledWith(actualAssets);

      expect(await venusERC4626Core.balanceOf(user.address)).to.equal(actualShares);
    });

    it("should return correct assets amount", async () => {
      const returnedAssets = await venusERC4626Core.connect(user).callStatic.mint(mintShares, user.address);
      expect(returnedAssets).to.equal(expectedAssets);
    });

    it("should revert if vToken mint fails", async () => {
      vToken.mint.returns(1); // Error code 1
      await expect(venusERC4626Core.connect(user).mint(mintShares, user.address)).to.be.revertedWithCustomError(
        venusERC4626Core,
        "VenusERC4626__VenusError",
      );
    });

    it("should fail mint with no approval", async () => {
      asset.transferFrom.returns(false);
      await expect(venusERC4626Core.connect(user).mint(mintShares, user.address)).to.be.reverted;
    });

    it("should fail mint zero shares", async () => {
      await expect(venusERC4626Core.connect(user).mint(0, user.address))
        .to.be.revertedWithCustomError(venusERC4626Core, "ERC4626__ZeroAmount")
        .withArgs("mint");
    });
  });

  describe("Deposit Operations", () => {
    const depositAmount = ethers.utils.parseUnits("10", 18);
    let expectedShares: ethers.BigNumber;

    beforeEach(async () => {
      asset.transferFrom.returns(true);
      asset.approve.returns(true);

      asset.balanceOf.returnsAtCall(0, ethers.BigNumber.from(0));
      asset.balanceOf.returnsAtCall(1, depositAmount);

      vToken.balanceOf.returnsAtCall(0, ethers.BigNumber.from(0));
      vToken.balanceOf.returnsAtCall(1, depositAmount);

      vToken.mint.returns(0); // NO_ERROR
      vToken.exchangeRateStored.returns(ethers.utils.parseUnits("1.0001", 18));

      await venusERC4626Core.setMaxDeposit(ethers.utils.parseEther("100")); // sets max deposit allowed
      await venusERC4626Core.setTotalSupply(ethers.utils.parseUnits("100", 18)); // sets total supply
      await venusERC4626Core.setTotalAssets(ethers.utils.parseUnits("100", 18)); // sets total assets
    });

    it("should deposit assets successfully", async () => {
      // Calculate shares using previewDeposit
      expectedShares = await venusERC4626Core.previewDeposit(depositAmount);

      const tx = await venusERC4626Core.connect(user).deposit(depositAmount, user.address);

      const receipt = await tx.wait();
      const depositEvent = receipt.events?.find(e => e.event === "Deposit");
      const [actualCaller, actualReceiver, actualAssets, actualShares] = depositEvent?.args || [];

      expect(actualCaller).to.equal(user.address);
      expect(actualReceiver).to.equal(user.address);
      expect(actualAssets).to.equal(depositAmount);
      expect(actualShares).to.be.gte(expectedShares);

      expect(vToken.mint).to.have.been.calledWith(depositAmount);
      expect(await venusERC4626Core.balanceOf(user.address)).to.be.gte(expectedShares);
    });

    it("should revert if vToken mint fails", async () => {
      vToken.mint.returns(1); // Error code 1
      await expect(
        venusERC4626Core.connect(user).deposit(ethers.utils.parseEther("50"), user.address),
      ).to.be.revertedWithCustomError(venusERC4626Core, "VenusERC4626__VenusError");
    });

    it("should fail deposit with no approval", async () => {
      asset.transferFrom.returns(false);
      await expect(venusERC4626Core.connect(user).deposit(ethers.utils.parseEther("1"), user.address)).to.be.reverted;
    });

    it("should fail deposit zero amount", async () => {
      await expect(venusERC4626Core.connect(user).deposit(0, user.address))
        .to.be.revertedWithCustomError(venusERC4626Core, "ERC4626__ZeroAmount")
        .withArgs("deposit");
    });
  });

  describe("Withdraw Operations", () => {
    const depositAmount = ethers.utils.parseEther("10");
    const withdrawAmount = ethers.utils.parseEther("5");
    let expectedShares: ethers.BigNumber;

    beforeEach(async () => {
      asset.transferFrom.returns(true);
      asset.approve.returns(true);
      asset.transfer.returns(true);

      vToken.mint.returns(0); // NO_ERROR
      vToken.redeemUnderlying.returns(0);
      vToken.exchangeRateStored.returns(ethers.utils.parseUnits("1.0001", 18));

      asset.balanceOf.returnsAtCall(0, ethers.BigNumber.from(0));
      asset.balanceOf.returnsAtCall(1, depositAmount);
      asset.balanceOf.returnsAtCall(2, ethers.utils.parseUnits("110", 18));
      asset.balanceOf.returnsAtCall(3, ethers.utils.parseUnits("110", 18).add(withdrawAmount));

      vToken.balanceOf.returnsAtCall(0, ethers.BigNumber.from(0));
      vToken.balanceOf.returnsAtCall(1, depositAmount);
      vToken.balanceOf.returnsAtCall(2, ethers.utils.parseUnits("110", 18));
      vToken.balanceOf.returnsAtCall(3, ethers.utils.parseUnits("105", 18));

      await venusERC4626Core.setMaxDeposit(ethers.utils.parseEther("50"));
      await venusERC4626Core.setTotalSupply(ethers.utils.parseUnits("100", 18)); // sets total supply
      await venusERC4626Core.setTotalAssets(ethers.utils.parseUnits("100", 18)); // sets total assets
      await venusERC4626Core.connect(user).deposit(depositAmount, user.address);
      await venusERC4626Core.setMaxWithdraw(ethers.utils.parseEther("15"));
      await venusERC4626Core.setTotalAssets(ethers.utils.parseUnits("110", 18)); // sets total assets
    });

    it("should withdraw assets successfully", async () => {
      expectedShares = await venusERC4626Core.previewWithdraw(withdrawAmount);

      const tx = await venusERC4626Core.connect(user).withdraw(withdrawAmount, user.address, user.address);

      const receipt = await tx.wait();
      const withdrawEvent = receipt.events?.find(e => e.event === "Withdraw");
      const [actualCaller, actualReceiver, actualOwner, actualAssets, actualShares] = withdrawEvent?.args || [];

      expect(actualCaller).to.equal(user.address);
      expect(actualReceiver).to.equal(user.address);
      expect(actualOwner).to.equal(user.address);
      expect(actualAssets).to.gte(withdrawAmount);
      expect(expectedShares).to.be.lte(actualShares);

      expect(vToken.redeemUnderlying).to.have.been.calledWith(withdrawAmount);
    });

    it("should revert if vToken redeemUnderlying fails", async () => {
      vToken.redeemUnderlying.returns(1); // Error code 1
      await expect(
        venusERC4626Core.connect(user).withdraw(withdrawAmount, user.address, user.address),
      ).to.be.revertedWithCustomError(venusERC4626Core, "VenusERC4626__VenusError");
    });

    it("should fail withdraw with no balance", async () => {
      await venusERC4626Core.setTotalAssets(0);
      await venusERC4626Core.setTotalSupply(0);
      await expect(venusERC4626Core.connect(user).withdraw(ethers.utils.parseEther("1"), user.address, user.address)).to
        .be.reverted;
    });

    it("should fail withdraw zero amount", async () => {
      await expect(venusERC4626Core.connect(user).withdraw(0, user.address, user.address))
        .to.be.revertedWithCustomError(venusERC4626Core, "ERC4626__ZeroAmount")
        .withArgs("withdraw");
    });
  });

  describe("Redeem Operations", () => {
    const depositAmount = ethers.utils.parseEther("10");
    const redeemShares = ethers.utils.parseEther("5");
    let expectedRedeemAssets: ethers.BigNumber;

    beforeEach(async () => {
      asset.transferFrom.returns(true);
      asset.approve.returns(true);
      asset.transfer.returns(true);

      vToken.mint.returns(0); // NO_ERROR
      vToken.redeem.returns(0);
      vToken.exchangeRateStored.returns(ethers.utils.parseUnits("1.0001", 18));

      asset.balanceOf.returnsAtCall(0, ethers.BigNumber.from(0));
      asset.balanceOf.returnsAtCall(1, depositAmount);
      asset.balanceOf.returnsAtCall(2, ethers.utils.parseUnits("110", 18));
      asset.balanceOf.returnsAtCall(3, ethers.utils.parseUnits("110", 18).add(redeemShares));

      vToken.balanceOf.returnsAtCall(0, ethers.BigNumber.from(0));
      vToken.balanceOf.returnsAtCall(1, depositAmount);
      vToken.balanceOf.returnsAtCall(3, ethers.utils.parseUnits("110", 18));

      await venusERC4626Core.setMaxDeposit(ethers.utils.parseEther("50"));
      await venusERC4626Core.setMaxRedeem(ethers.utils.parseEther("50"));
      await venusERC4626Core.setTotalSupply(ethers.utils.parseUnits("100", 18)); // sets total supply
      await venusERC4626Core.setTotalAssets(ethers.utils.parseUnits("100", 18)); // sets total assets
      await venusERC4626Core.connect(user).deposit(depositAmount, user.address);
      await venusERC4626Core.setTotalAssets(ethers.utils.parseUnits("110", 18)); // sets total assets

      expectedRedeemAssets = await venusERC4626Core.previewRedeem(redeemShares);
    });

    it("should redeem shares successfully", async () => {
      const tx = await venusERC4626Core.connect(user).redeem(redeemShares, user.address, user.address);

      const receipt = await tx.wait();
      const event = receipt.events?.find(e => e.event === "Withdraw");
      const [actualCaller, actualReceiver, actualOwner, actualAssets, actualShares] = event?.args || [];

      expect(actualCaller).to.equal(user.address);
      expect(actualReceiver).to.equal(user.address);
      expect(actualOwner).to.equal(user.address);

      expect(actualAssets).to.be.gte(expectedRedeemAssets);
      expect(actualShares).to.be.gte(redeemShares);
    });

    it("should return correct assets amount", async () => {
      const returnedAssets = await venusERC4626Core
        .connect(user)
        .callStatic.redeem(redeemShares, user.address, user.address);
      expect(returnedAssets).to.be.gte(expectedRedeemAssets);
    });

    it("should revert if vToken redeem fails", async () => {
      vToken.redeem.returns(1); // Error code 1
      await expect(
        venusERC4626Core.connect(user).redeem(redeemShares, user.address, user.address),
      ).to.be.revertedWithCustomError(venusERC4626Core, "VenusERC4626__VenusError");
    });

    it("should fail redeem zero shares", async () => {
      await expect(venusERC4626Core.connect(user).redeem(0, user.address, user.address))
        .to.be.revertedWithCustomError(venusERC4626Core, "ERC4626__ZeroAmount")
        .withArgs("redeem");
    });
  });

  describe("Reward Distribution", () => {
    const rewardAmount = ethers.utils.parseEther("10");

    describe("When rewardRecipient is EOA", () => {
      it("should claim rewards and transfer to recipient", async () => {
        comptroller.getXVSAddress.returns(xvs.address);
        xvs.balanceOf.whenCalledWith(venusERC4626Core.address).returns(rewardAmount);
        xvs.transfer.returns(true);

        await expect(venusERC4626Core.claimRewards())
          .to.emit(venusERC4626Core, "ClaimRewards")
          .withArgs(rewardAmount, xvs.address);

        expect(comptroller.claimVenus).to.have.been.calledWith(venusERC4626Core.address);

        expect(xvs.transfer).to.have.been.calledWith(rewardRecipient, rewardAmount);
        expect(rewardRecipientPSR.updateAssetsState).to.not.have.been.called;
      });
    });

    describe("When rewardRecipient is ProtocolShareReserve", () => {
      let venusERC4626WithPSR: MockVenusERC4626Core;

      beforeEach(async () => {
        // Deploy new instance with PSR as reward recipient
        const VenusERC4626Factory = await ethers.getContractFactory("MockVenusERC4626Core");
        venusERC4626WithPSR = await upgrades.deployProxy(VenusERC4626Factory, [vToken.address], {
          initializer: "initialize",
        });

        await venusERC4626WithPSR.initialize2(
          accessControlManager.address,
          rewardRecipientPSR.address,
          vaultOwner.address,
        );

        comptroller.getXVSAddress.returns(xvs.address);
        xvs.balanceOf.whenCalledWith(venusERC4626WithPSR.address).returns(rewardAmount);
        xvs.transfer.returns(true);
      });

      it("should claim rewards and update PSR state", async () => {
        await expect(venusERC4626WithPSR.claimRewards())
          .to.emit(venusERC4626WithPSR, "ClaimRewards")
          .withArgs(rewardAmount, xvs.address);

        expect(comptroller.claimVenus).to.have.been.calledWith(venusERC4626WithPSR.address);
        expect(xvs.transfer).to.have.been.calledWith(rewardRecipientPSR.address, rewardAmount);

        // Verify PSR state update
        expect(rewardRecipientPSR.updateAssetsState).to.have.been.calledWith(
          comptroller.address,
          xvs.address,
          2, // ERC4626_WRAPPER_REWARDS
        );
      });
    });
  });
});
