import { FakeContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import { constants } from "ethers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "hardhat-deploy-ethers/signers";

import {
  AccessControlManager,
  ERC20,
  IComptroller,
  PoolRegistryInterface,
  UpgradeableBeacon,
  VToken,
  VenusERC4626,
  VenusERC4626Factory,
} from "../../../typechain";

const { expect } = chai;
chai.use(smock.matchers);

describe("VenusERC4626Factory", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let factory: VenusERC4626Factory;
  let beacon: UpgradeableBeacon;
  let listedAsset: FakeContract<ERC20>;
  let vTokenA: FakeContract<VToken>;
  let vTokenB: FakeContract<VToken>;
  let fakeVToken: FakeContract<VToken>;
  let unlistedVToken: FakeContract<VToken>;
  let comptroller: FakeContract<IComptroller>;
  let poolRegistry: FakeContract<PoolRegistryInterface>;
  let accessControlManager: FakeContract<AccessControlManager>;
  let rewardRecipient: string;
  let venusERC4626Impl: VenusERC4626;

  beforeEach(async () => {
    [deployer, user] = await ethers.getSigners();

    listedAsset = await smock.fake("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
    vTokenA = await smock.fake("@venusprotocol/isolated-pools/contracts/VToken.sol:VToken");
    vTokenB = await smock.fake("@venusprotocol/isolated-pools/contracts/VToken.sol:VToken");
    fakeVToken = await smock.fake("@venusprotocol/isolated-pools/contracts/VToken.sol:VToken");
    unlistedVToken = await smock.fake("@venusprotocol/isolated-pools/contracts/VToken.sol:VToken");
    comptroller = await smock.fake("@venusprotocol/isolated-pools/contracts/Comptroller.sol:Comptroller");
    poolRegistry = await smock.fake(
      "@venusprotocol/isolated-pools/contracts/Pool/PoolRegistryInterface.sol:PoolRegistryInterface",
    );
    accessControlManager = await smock.fake("AccessControlManager");
    rewardRecipient = deployer.address;

    accessControlManager.isAllowedToCall.returns(true);
    comptroller.poolRegistry.returns(poolRegistry.address);

    vTokenA.comptroller.returns(comptroller.address);
    vTokenA.underlying.returns(listedAsset.address);

    const otherAsset = await smock.fake("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
    vTokenB.comptroller.returns(comptroller.address);
    vTokenB.underlying.returns(otherAsset.address);

    fakeVToken.comptroller.returns(constants.AddressZero);
    unlistedVToken.comptroller.returns(comptroller.address);
    unlistedVToken.underlying.returns(ethers.Wallet.createRandom().address); // Random underlying

    vTokenB.comptroller.returns(comptroller.address);

    poolRegistry.getPoolByComptroller.whenCalledWith(comptroller.address).returns({
      name: "Test Pool",
      creator: deployer.address,
      comptroller: comptroller.address,
      blockPosted: 123456,
      timestampPosted: Math.floor(Date.now() / 1000),
    });

    poolRegistry.getPoolByComptroller.whenCalledWith(constants.AddressZero).returns({
      name: "",
      creator: constants.AddressZero,
      comptroller: constants.AddressZero,
      blockPosted: 0,
      timestampPosted: 0,
    });

    poolRegistry.getVTokenForAsset.whenCalledWith(comptroller.address, listedAsset.address).returns(vTokenA.address);

    poolRegistry.getVTokenForAsset.whenCalledWith(comptroller.address, otherAsset.address).returns(vTokenB.address);

    const VenusERC4626 = await ethers.getContractFactory("VenusERC4626");
    venusERC4626Impl = await VenusERC4626.deploy();
    await venusERC4626Impl.deployed();

    const Factory = await ethers.getContractFactory("VenusERC4626Factory");
    factory = await upgrades.deployProxy(
      Factory,
      [accessControlManager.address, poolRegistry.address, rewardRecipient, venusERC4626Impl.address, 10],
      { initializer: "initialize" },
    );

    beacon = await ethers.getContractAt("UpgradeableBeacon", await factory.beacon());
  });

  describe("Initialization", () => {
    it("should set correct initial values", async () => {
      expect(await factory.poolRegistry()).to.equal(poolRegistry.address);
      expect(await factory.rewardRecipient()).to.equal(rewardRecipient);
      expect(await factory.maxLoopsLimit()).to.equal(10);
    });

    it("should setup beacon proxy correctly", async () => {
      expect(await beacon.implementation()).to.equal(venusERC4626Impl.address);
    });

    it("should set the owner of the beacon to the owner of the factory", async () => {
      expect(await beacon.owner()).to.equal(await factory.owner());
    });
  });

  describe("Vault Creation", () => {
    it("should create vault and emit event", async () => {
      const tx = await factory.createERC4626(vTokenA.address);
      const receipt = await tx.wait();
      const event = receipt.events?.find(e => e.event === "CreateERC4626");

      expect(event?.args?.vToken).to.equal(vTokenA.address);
      expect(event?.args?.vault).to.not.equal(constants.AddressZero);
    });

    it("should set the owner of the vault", async () => {
      const tx = await factory.createERC4626(vTokenA.address);
      const receipt = await tx.wait();
      const deployed = receipt.events?.find(e => e.event === "CreateERC4626")?.args?.vault;

      const venusERC4626 = await ethers.getContractAt("VenusERC4626", deployed);

      expect(await venusERC4626.owner()).to.equal(await factory.owner());
    });

    it("should revert for zero vToken address", async () => {
      await expect(factory.createERC4626(constants.AddressZero)).to.be.revertedWithCustomError(
        factory,
        "ZeroAddressNotAllowed",
      );
    });

    it("should revert for unlisted vToken", async () => {
      await expect(factory.createERC4626(unlistedVToken.address)).to.be.revertedWithCustomError(
        factory,
        "VenusERC4626Factory__InvalidVToken",
      );
    });
  });

  describe("CREATE2 Functionality", () => {
    it("should deploy to predicted address", async () => {
      const predicted = await factory.computeVaultAddress(vTokenA.address);
      const tx = await factory.createERC4626(vTokenA.address);
      const receipt = await tx.wait();
      const deployed = receipt.events?.find(e => e.event === "CreateERC4626")?.args?.vault;

      expect(deployed).to.equal(predicted);
    });

    it("should revert for deployment of same vToken", async () => {
      await factory.createERC4626(vTokenA.address);
      await expect(factory.createERC4626(vTokenA.address)).to.be.revertedWithCustomError(
        factory,
        "VenusERC4626Factory__ERC4626AlreadyExists",
      );
    });

    it("should revert for deployment of same vToken after updating reward recipient", async () => {
      const newRecipient = ethers.Wallet.createRandom().address;

      await factory.createERC4626(vTokenA.address);
      await factory.setRewardRecipient(newRecipient);

      await expect(factory.createERC4626(vTokenA.address)).to.be.reverted;
    });

    it("should revert for deployment of same vToken after updating max loop limit", async () => {
      const maxLoopsLimit = await factory.maxLoopsLimit();
      const newMaxLoopLimit = maxLoopsLimit.add(10);

      await factory.createERC4626(vTokenA.address);
      await factory.setMaxLoopsLimit(newMaxLoopLimit);

      await expect(factory.createERC4626(vTokenA.address)).to.be.reverted;
    });

    it("Should not revert for deployment of different vTokens", async () => {
      await factory.createERC4626(vTokenA.address);
      await expect(factory.createERC4626(vTokenB.address));
    });
  });

  describe("Access Control", () => {
    it("should allow authorized accounts to update reward recipient", async () => {
      const newRecipient = ethers.Wallet.createRandom().address;
      await expect(factory.setRewardRecipient(newRecipient))
        .to.emit(factory, "RewardRecipientUpdated")
        .withArgs(rewardRecipient, newRecipient);
    });

    it("should allow authorized accounts to update maxLoopsLimit", async () => {
      const maxLoopsLimit = await factory.maxLoopsLimit();
      const newMaxLoopLimit = maxLoopsLimit.add(10);
      await expect(factory.setMaxLoopsLimit(newMaxLoopLimit))
        .to.emit(factory, "MaxLoopsLimitUpdated")
        .withArgs(maxLoopsLimit, newMaxLoopLimit);
    });

    it("should revert when unauthorized user tries to update", async () => {
      accessControlManager.isAllowedToCall.returns(false);
      await expect(factory.connect(user).setRewardRecipient(user.address)).to.be.revertedWithCustomError(
        factory,
        "Unauthorized",
      );
    });
  });

  describe("Beacon Proxy Verification", () => {
    it("should deploy valid BeaconProxy", async () => {
      // Deploy the vault
      const tx = await factory.createERC4626(vTokenA.address);
      const receipt = await tx.wait();
      const vaultAddress = receipt.events?.find(e => e.event === "CreateERC4626")?.args?.vault;

      // Verify proxy storage slot (EIP-1967)
      const beaconSlot = ethers.BigNumber.from(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("eip1967.proxy.beacon")),
      ).sub(1);
      const beaconAddress = await ethers.provider.getStorageAt(vaultAddress, beaconSlot);

      // Storage returns 32 bytes, last 20 bytes are the address
      expect(ethers.utils.getAddress("0x" + beaconAddress.slice(-40))).to.equal(await factory.beacon());
    });
  });
});
