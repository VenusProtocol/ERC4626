import { FakeContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import { constants } from "ethers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "hardhat-deploy-ethers/signers";

import {
  ComptrollerInterface,
  VToken as CoreVToken,
  ERC20,
  ERC4626Factory,
  IAccessControlManagerV8,
  VToken as IsolatedVToken,
  PoolRegistryInterface,
  UpgradeableBeacon,
  VenusERC4626Core,
  VenusERC4626Isolated,
} from "../../typechain";

const { expect } = chai;
chai.use(smock.matchers);

describe("VenusERC4626Factory", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let factory: ERC4626Factory;
  let isolatedBeacon: UpgradeableBeacon;
  let coreBeacon: UpgradeableBeacon;
  let asset1: FakeContract<ERC20>;
  let asset2: FakeContract<ERC20>;
  let coreVToken: FakeContract<CoreVToken>;
  let isolatedVToken: FakeContract<IsolatedVToken>;
  let invalidVToken: FakeContract<CoreVToken>;
  let coreComptroller: FakeContract<ComptrollerInterface>;
  let poolRegistry: FakeContract<PoolRegistryInterface>;
  let accessControl: FakeContract<IAccessControlManagerV8>;
  let rewardRecipient: string;
  let venusERC4626CoreImpl: VenusERC4626Core;
  let venusERC4626IsolatedImpl: VenusERC4626Isolated;

  beforeEach(async () => {
    [deployer, user] = await ethers.getSigners();

    // Setup fake contracts
    asset1 = await smock.fake("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
    asset2 = await smock.fake("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
    coreVToken = await smock.fake("VToken");
    isolatedVToken = await smock.fake("VToken");
    invalidVToken = await smock.fake("VToken");
    accessControl = await smock.fake("IAccessControlManagerV8");
    rewardRecipient = deployer.address;

    // Setup core pool
    coreComptroller = await smock.fake<ComptrollerInterface>(
      "contracts/interfaces/ComptrollerInterface.sol:ComptrollerInterface",
    );
    coreVToken.comptroller.returns(coreComptroller.address);
    coreVToken.underlying.returns(asset1.address);
    coreComptroller.markets.whenCalledWith(coreVToken.address).returns([true, 0]);

    // Setup isolated pool
    poolRegistry = await smock.fake<PoolRegistryInterface>("PoolRegistryInterface");
    isolatedVToken.comptroller.returns(ethers.Wallet.createRandom().address);
    isolatedVToken.underlying.returns(asset2.address);
    poolRegistry.getVTokenForAsset.returns(isolatedVToken.address);

    // Setup invalid vToken
    invalidVToken.comptroller.returns(constants.AddressZero);

    // Deploy implementations
    const VenusERC4626Core = await ethers.getContractFactory("VenusERC4626Core");
    venusERC4626CoreImpl = await VenusERC4626Core.deploy();

    const VenusERC4626Isolated = await ethers.getContractFactory("VenusERC4626Isolated");
    venusERC4626IsolatedImpl = await VenusERC4626Isolated.deploy();

    // Deploy factory
    const Factory = await ethers.getContractFactory("ERC4626Factory");
    factory = await upgrades.deployProxy(
      Factory,
      [
        accessControl.address,
        venusERC4626IsolatedImpl.address,
        venusERC4626CoreImpl.address,
        poolRegistry.address,
        coreComptroller.address,
        rewardRecipient,
        100,
      ],
      { initializer: "initialize" },
    );

    isolatedBeacon = await ethers.getContractAt("UpgradeableBeacon", await factory.isolatedBeacon());
    coreBeacon = await ethers.getContractAt("UpgradeableBeacon", await factory.coreBeacon());
  });

  describe("Initialization", () => {
    it("should set correct initial values", async () => {
      expect(await factory.accessControlManager()).to.equal(accessControl.address);
      expect(await factory.poolRegistry()).to.equal(poolRegistry.address);
      expect(await factory.coreComptroller()).to.equal(coreComptroller.address);
      expect(await factory.rewardRecipient()).to.equal(rewardRecipient);
    });

    it("should setup beacons correctly", async () => {
      expect(await isolatedBeacon.implementation()).to.equal(venusERC4626IsolatedImpl.address);
      expect(await coreBeacon.implementation()).to.equal(venusERC4626CoreImpl.address);
    });

    it("should set beacon owners to factory owner", async () => {
      expect(await isolatedBeacon.owner()).to.equal(await factory.owner());
      expect(await coreBeacon.owner()).to.equal(await factory.owner());
    });
  });

  describe("Vault Creation", () => {
    it("should create core vault and emit event", async () => {
      const tx = await factory.createERC4626(coreVToken.address, true);
      const receipt = await tx.wait();
      const event = receipt.events?.find(e => e.event === "VaultCreated");

      expect(event?.args?.vToken).to.equal(coreVToken.address);
      expect(event?.args?.isCore).to.be.true;
    });

    it("should create isolated vault and emit event", async () => {
      const tx = await factory.createERC4626(isolatedVToken.address, false);
      const receipt = await tx.wait();
      const event = receipt.events?.find(e => e.event === "VaultCreated");

      expect(event?.args?.vToken).to.equal(isolatedVToken.address);
      expect(event?.args?.isCore).to.be.false;
    });

    it("should revert for invalid core vToken", async () => {
      coreComptroller.markets.whenCalledWith(invalidVToken.address).returns([false, 0]);
      await expect(factory.createERC4626(invalidVToken.address, true)).to.be.revertedWithCustomError(
        factory,
        "InvalidVToken",
      );
    });

    it("should revert for invalid isolated vToken", async () => {
      poolRegistry.getVTokenForAsset.returns(constants.AddressZero);
      await expect(factory.createERC4626(invalidVToken.address, false)).to.be.revertedWithCustomError(
        factory,
        "InvalidVToken",
      );
    });

    it("should revert for duplicate vToken", async () => {
      await factory.createERC4626(coreVToken.address, true);
      await expect(factory.createERC4626(coreVToken.address, true)).to.be.revertedWithCustomError(
        factory,
        "VaultAlreadyExists",
      );
    });
  });

  describe("CREATE2 Functionality", () => {
    it("should deploy core vault to predicted address", async () => {
      const predicted = await factory.computeVaultAddress(coreVToken.address, true);
      const tx = await factory.createERC4626(coreVToken.address, true);
      const deployed = (await tx.wait()).events?.find(e => e.event === "VaultCreated")?.args?.vault;
      expect(deployed).to.equal(predicted);
    });

    it("should deploy isolated vault to predicted address", async () => {
      const predicted = await factory.computeVaultAddress(isolatedVToken.address, false);
      const tx = await factory.createERC4626(isolatedVToken.address, false);
      const deployed = (await tx.wait()).events?.find(e => e.event === "VaultCreated")?.args?.vault;
      expect(deployed).to.equal(predicted);
    });
  });

  describe("Access Control", () => {
    it("should allow ACM-authorized calls to setRewardRecipient", async () => {
      accessControl.isAllowedToCall.returns(true);
      const newRecipient = ethers.Wallet.createRandom().address;
      await expect(factory.setRewardRecipient(newRecipient))
        .to.emit(factory, "RewardRecipientUpdated")
        .withArgs(rewardRecipient, newRecipient);
    });

    it("should allow authorized accounts to update maxLoopsLimit", async () => {
      accessControl.isAllowedToCall.returns(true);
      const maxLoopsLimit = await factory.maxLoopsLimit();
      const newMaxLoopLimit = maxLoopsLimit.add(10);
      await expect(factory.setMaxLoopsLimit(newMaxLoopLimit))
        .to.emit(factory, "MaxLoopsLimitUpdated")
        .withArgs(maxLoopsLimit, newMaxLoopLimit);
    });

    it("should revert unauthorized setRewardRecipient calls", async () => {
      accessControl.isAllowedToCall.returns(false);
      await expect(factory.connect(user).setRewardRecipient(user.address)).to.be.revertedWithCustomError(
        factory,
        "Unauthorized",
      );
    });
  });

  describe("Beacon Verification", () => {
    it("should use correct beacon for core vault", async () => {
      const tx = await factory.createERC4626(coreVToken.address, true);
      const vaultAddress = (await tx.wait()).events?.find(e => e.event === "VaultCreated")?.args?.vault;

      const beaconSlot = ethers.utils.hexlify(
        ethers.BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("eip1967.proxy.beacon"))).sub(1),
      );

      const beaconAddress = await ethers.provider.getStorageAt(vaultAddress, beaconSlot);
      expect(ethers.utils.getAddress("0x" + beaconAddress.slice(-40))).to.equal(coreBeacon.address);
    });

    it("should use correct beacon for isolated vault", async () => {
      const tx = await factory.createERC4626(isolatedVToken.address, false);
      const vaultAddress = (await tx.wait()).events?.find(e => e.event === "VaultCreated")?.args?.vault;

      const beaconSlot = ethers.utils.hexlify(
        ethers.BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("eip1967.proxy.beacon"))).sub(1),
      );

      const beaconAddress = await ethers.provider.getStorageAt(vaultAddress, beaconSlot);
      expect(ethers.utils.getAddress("0x" + beaconAddress.slice(-40))).to.equal(isolatedBeacon.address);
    });
  });

  describe("Vault Initialization", () => {
    it("should initialize core vault with correct parameters", async () => {
      const tx = await factory.createERC4626(coreVToken.address, true);
      const vaultAddress = (await tx.wait()).events?.find(e => e.event === "VaultCreated")?.args?.vault;
      const vault = await ethers.getContractAt("VenusERC4626Core", vaultAddress);

      expect(await vault.owner()).to.equal(await factory.owner());
      expect(await vault.rewardRecipient()).to.equal(rewardRecipient);
    });

    it("should initialize isolated vault with correct parameters", async () => {
      const tx = await factory.createERC4626(isolatedVToken.address, false);
      const vaultAddress = (await tx.wait()).events?.find(e => e.event === "VaultCreated")?.args?.vault;
      const vault = await ethers.getContractAt("VenusERC4626Isolated", vaultAddress);

      expect(await vault.owner()).to.equal(await factory.owner());
      expect(await vault.rewardRecipient()).to.equal(rewardRecipient);
      expect(await vault.maxLoopsLimit()).to.equal(await factory.maxLoopsLimit());
    });
  });
});
