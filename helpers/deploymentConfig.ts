import { contracts as governanceArbitrumOne } from "@venusprotocol/governance-contracts/deployments/arbitrumone.json";
import { contracts as governanceArbitrumSepolia } from "@venusprotocol/governance-contracts/deployments/arbitrumsepolia.json";
import { contracts as governanceBaseMainnet } from "@venusprotocol/governance-contracts/deployments/basemainnet.json";
import { contracts as governanceBaseSepolia } from "@venusprotocol/governance-contracts/deployments/basesepolia.json";
import { contracts as governanceBscMainnet } from "@venusprotocol/governance-contracts/deployments/bscmainnet.json";
import { contracts as governanceBscTestnet } from "@venusprotocol/governance-contracts/deployments/bsctestnet.json";
import { contracts as governanceEthereum } from "@venusprotocol/governance-contracts/deployments/ethereum.json";
import { contracts as governanceOpbnbMainnet } from "@venusprotocol/governance-contracts/deployments/opbnbmainnet.json";
import { contracts as governanceOpbnbTestnet } from "@venusprotocol/governance-contracts/deployments/opbnbtestnet.json";
import { contracts as governanceSepolia } from "@venusprotocol/governance-contracts/deployments/sepolia.json";
import { contracts as governanceZkSyncMainnet } from "@venusprotocol/governance-contracts/deployments/zksyncmainnet.json";
import { contracts as governanceZkSyncSepolia } from "@venusprotocol/governance-contracts/deployments/zksyncsepolia.json";
import { Wallet } from "ethers";

export type NetworkConfig = {
  hardhat: DeploymentConfig;
  bsctestnet: DeploymentConfig;
  bscmainnet: DeploymentConfig;
  sepolia: DeploymentConfig;
  ethereum: DeploymentConfig;
  opbnbtestnet: DeploymentConfig;
  opbnbmainnet: DeploymentConfig;
  arbitrumsepolia: DeploymentConfig;
  arbitrumone: DeploymentConfig;
  zksyncsepolia: DeploymentConfig;
  zksyncmainnet: DeploymentConfig;
  opsepolia: DeploymentConfig;
  opmainnet: DeploymentConfig;
  basesepolia: DeploymentConfig;
  basemainnet: DeploymentConfig;
  unichainsepolia: DeploymentConfig;
  unichainmainnet: DeploymentConfig;
};

export type PreconfiguredAddresses = { [contract: string]: string };

export type DeploymentConfig = {
  preconfiguredAddresses: PreconfiguredAddresses;
};

export const SEPOLIA_MULTISIG = "0x94fa6078b6b8a26f0b6edffbe6501b22a10470fb";
export const ETHEREUM_MULTISIG = "0x285960C5B22fD66A736C7136967A3eB15e93CC67";
export const OPBNBTESTNET_MULTISIG = "0xb15f6EfEbC276A3b9805df81b5FB3D50C2A62BDf";
export const OPBNBMAINNET_MULTISIG = "0xC46796a21a3A9FAB6546aF3434F2eBfFd0604207";
export const ARBITRUM_SEPOLIA_MULTISIG = "0x1426A5Ae009c4443188DA8793751024E358A61C2";
export const ARBITRUM_ONE_MULTISIG = "0x14e0E151b33f9802b3e75b621c1457afc44DcAA0";
export const ZKSYNC_SEPOLIA_MULTISIG = "0xa2f83de95E9F28eD443132C331B6a9C9B7a9F866";
export const ZKSYNC_MAINNET_MULTISIG = "0x751Aa759cfBB6CE71A43b48e40e1cCcFC66Ba4aa";
export const OP_SEPOLIA_MULTISIG = "0xd57365EE4E850e881229e2F8Aa405822f289e78d";
export const OP_MAINNET_MULTISIG = "0x2e94dd14E81999CdBF5deDE31938beD7308354b3";
export const BASE_SEPOLIA_MULTISIG = "0xdf3b635d2b535f906BB02abb22AED71346E36a00";
export const BASE_MAINNET_MULTISIG = "0x1803Cf1D3495b43cC628aa1d8638A981F8CD341C";
export const UNICHAIN_SEPOLIA_MULTISIG = "0x9831D3A641E8c7F082EEA75b8249c99be9D09a34";
export const UNICHAIN_MAINNET_MULTISIG = "0x1803Cf1D3495b43cC628aa1d8638A981F8CD341C";

export const preconfiguredAddresses = {
  hardhat: {
    VTreasury: "account:deployer",
    AccessControlManager: Wallet.createRandom().address,
    PoolRegistry: Wallet.createRandom().address,
    CoreComptroller: Wallet.createRandom().address,
    XVS: Wallet.createRandom().address,
    VBNB: Wallet.createRandom().address,
  },
  bsctestnet: {
    NormalTimelock: governanceBscTestnet.NormalTimelock.address,
    AccessControlManager: governanceBscTestnet.AccessControlManager.address,
  },
  bscmainnet: {
    NormalTimelock: governanceBscMainnet.NormalTimelock.address,
    AccessControlManager: governanceBscMainnet.AccessControlManager.address,
  },
  sepolia: {
    NormalTimelock: governanceSepolia.NormalTimelock.address,
    AccessControlManager: governanceSepolia.AccessControlManager.address,
  },
  ethereum: {
    NormalTimelock: governanceEthereum.NormalTimelock.address,
    AccessControlManager: governanceEthereum.AccessControlManager.address,
  },
  opbnbtestnet: {
    NormalTimelock: OPBNBTESTNET_MULTISIG,
    AccessControlManager: governanceOpbnbTestnet.AccessControlManager.address,
  },
  opbnbmainnet: {
    NormalTimelock: OPBNBMAINNET_MULTISIG,
    AccessControlManager: governanceOpbnbMainnet.AccessControlManager.address,
  },
  arbitrumsepolia: {
    NormalTimelock: governanceArbitrumSepolia.NormalTimelock.address,
    AccessControlManager: governanceArbitrumSepolia.AccessControlManager.address,
  },
  arbitrumone: {
    NormalTimelock: governanceArbitrumOne.NormalTimelock.address,
    AccessControlManager: governanceArbitrumOne.AccessControlManager.address,
  },
  zksyncsepolia: {
    NormalTimelock: governanceZkSyncSepolia.NormalTimelock.address,
    AccessControlManager: governanceZkSyncSepolia.AccessControlManager.address,
  },
  zksyncmainnet: {
    NormalTimelock: governanceZkSyncMainnet.NormalTimelock.address,
    AccessControlManager: governanceZkSyncMainnet.AccessControlManager.address,
  },
  opsepolia: {
    NormalTimelock: OP_SEPOLIA_MULTISIG,
    AccessControlManager: "0x1652E12C8ABE2f0D84466F0fc1fA4286491B3BC1",
  },
  opmainnet: {
    NormalTimelock: OP_MAINNET_MULTISIG,
    AccessControlManager: "0xD71b1F33f6B0259683f11174EE4Ddc2bb9cE4eD6",
  },
  basesepolia: {
    NormalTimelock: governanceBaseSepolia.NormalTimelock.address,
    AccessControlManager: "0x724138223D8F76b519fdE715f60124E7Ce51e051",
  },
  basemainnet: {
    NormalTimelock: governanceBaseMainnet.NormalTimelock.address,
    AccessControlManager: "0x9E6CeEfDC6183e4D0DF8092A9B90cDF659687daB",
  },
  unichainsepolia: {
    NormalTimelock: "0x5e20F5A2e23463D39287185DF84607DF7068F314",
    AccessControlManager: "0x854C064EA6b503A97980F481FA3B7279012fdeDd",
  },
  unichainmainnet: {
    NormalTimelock: "0x918532A78d22419Da4091930d472bDdf532BE89a",
    AccessControlManager: "0x1f12014c497a9d905155eB9BfDD9FaC6885e61d0",
  },
};

export const globalConfig: NetworkConfig = {
  hardhat: {
    preconfiguredAddresses: preconfiguredAddresses.hardhat,
  },
  bsctestnet: {
    preconfiguredAddresses: preconfiguredAddresses.bsctestnet,
  },
  bscmainnet: {
    preconfiguredAddresses: preconfiguredAddresses.bscmainnet,
  },
  sepolia: {
    preconfiguredAddresses: preconfiguredAddresses.sepolia,
  },
  ethereum: {
    preconfiguredAddresses: preconfiguredAddresses.ethereum,
  },
  opbnbtestnet: {
    preconfiguredAddresses: preconfiguredAddresses.opbnbtestnet,
  },
  opbnbmainnet: {
    preconfiguredAddresses: preconfiguredAddresses.opbnbmainnet,
  },
  arbitrumsepolia: {
    preconfiguredAddresses: preconfiguredAddresses.arbitrumsepolia,
  },
  arbitrumone: {
    preconfiguredAddresses: preconfiguredAddresses.arbitrumone,
  },
  zksyncsepolia: {
    preconfiguredAddresses: preconfiguredAddresses.zksyncsepolia,
  },
  zksyncmainnet: {
    preconfiguredAddresses: preconfiguredAddresses.zksyncmainnet,
  },
  opsepolia: {
    preconfiguredAddresses: preconfiguredAddresses.opsepolia,
  },
  opmainnet: {
    preconfiguredAddresses: preconfiguredAddresses.opmainnet,
  },
  basesepolia: {
    preconfiguredAddresses: preconfiguredAddresses.basesepolia,
  },
  basemainnet: {
    preconfiguredAddresses: preconfiguredAddresses.basemainnet,
  },
  unichainsepolia: {
    preconfiguredAddresses: preconfiguredAddresses.unichainsepolia,
  },
  unichainmainnet: {
    preconfiguredAddresses: preconfiguredAddresses.unichainmainnet,
  },
};

export async function getConfig(networkName: string): Promise<DeploymentConfig> {
  switch (networkName) {
    case "hardhat":
      return globalConfig.hardhat;
    case "bsctestnet":
      return globalConfig.bsctestnet;
    case "bscmainnet":
      return globalConfig.bscmainnet;
    case "sepolia":
      return globalConfig.sepolia;
    case "ethereum":
      return globalConfig.ethereum;
    case "opbnbtestnet":
      return globalConfig.opbnbtestnet;
    case "opbnbmainnet":
      return globalConfig.opbnbmainnet;
    case "arbitrumsepolia":
      return globalConfig.arbitrumsepolia;
    case "arbitrumone":
      return globalConfig.arbitrumone;
    case "zksyncsepolia":
      return globalConfig.zksyncsepolia;
    case "zksyncmainnet":
      return globalConfig.zksyncmainnet;
    case "opsepolia":
      return globalConfig.opsepolia;
    case "opmainnet":
      return globalConfig.opmainnet;
    case "basesepolia":
      return globalConfig.basesepolia;
    case "basemainnet":
      return globalConfig.basemainnet;
    case "unichainsepolia":
      return globalConfig.unichainsepolia;
    case "unichainmainnet":
      return globalConfig.unichainmainnet;
    case "development":
      return globalConfig.bsctestnet;
    default:
      throw new Error(`config for network ${networkName} is not available.`);
  }
}
