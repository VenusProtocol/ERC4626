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
import { contracts as venusProtocolArbitrumOne } from "@venusprotocol/venus-protocol/deployments/arbitrumone.json";
import { contracts as venusProtocolArbitrumSepolia } from "@venusprotocol/venus-protocol/deployments/arbitrumsepolia.json";
import { contracts as venusProtocolBscMainnet } from "@venusprotocol/venus-protocol/deployments/bscmainnet.json";
import { contracts as venusProtocolBscTestnet } from "@venusprotocol/venus-protocol/deployments/bsctestnet.json";
import { contracts as venusProtocolEthereum } from "@venusprotocol/venus-protocol/deployments/ethereum.json";
import { contracts as venusProtocolOpbnbMainnet } from "@venusprotocol/venus-protocol/deployments/opbnbmainnet.json";
import { contracts as venusProtocolOpbnbTestnet } from "@venusprotocol/venus-protocol/deployments/opbnbtestnet.json";
import { contracts as venusProtocolSepolia } from "@venusprotocol/venus-protocol/deployments/sepolia.json";
import { contracts as venusProtocolZkSyncMainnet } from "@venusprotocol/venus-protocol/deployments/zksyncmainnet.json";
import { contracts as venusProtocolZkSyncSepolia } from "@venusprotocol/venus-protocol/deployments/zksyncsepolia.json";
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
  berachainbartio: DeploymentConfig;
};

export type PreconfiguredAddresses = { [contract: string]: string };

export type DeploymentConfig = {
  preconfiguredAddresses: PreconfiguredAddresses;
};

export type DeploymentInfo = { isTimeBased: true; blocksPerYear: 0 } | { isTimeBased: false; blocksPerYear: number };

export const DEFAULT_BLOCKS_PER_YEAR = 21_024_000; // assuming a block is mined every 1.5 seconds
export const BSC_BLOCKS_PER_YEAR = 21_024_000; // assuming a block is mined every 1.5 seconds
export const ETH_BLOCKS_PER_YEAR = 2_628_000; // assuming a block is mined every 12 seconds
export const OPBNB_BLOCKS_PER_YEAR = 63_072_000; // assuming a block is mined every 0.5 seconds
export const SECONDS_PER_YEAR = 31_536_000; // seconds per year

export type BlocksPerYear = number | "time-based";

export const blocksPerYear: Record<string, BlocksPerYear> = {
  hardhat: process.env.IS_TIME_BASED_DEPLOYMENT === "true" ? "time-based" : DEFAULT_BLOCKS_PER_YEAR,
  bsctestnet: BSC_BLOCKS_PER_YEAR,
  bscmainnet: BSC_BLOCKS_PER_YEAR,
  sepolia: ETH_BLOCKS_PER_YEAR,
  ethereum: ETH_BLOCKS_PER_YEAR,
  opbnbtestnet: OPBNB_BLOCKS_PER_YEAR,
  opbnbmainnet: OPBNB_BLOCKS_PER_YEAR,
  arbitrumsepolia: "time-based",
  arbitrumone: "time-based",
  zksyncsepolia: "time-based",
  zksyncmainnet: "time-based",
  opsepolia: "time-based",
  opmainnet: "time-based",
  basesepolia: "time-based",
  basemainnet: "time-based",
  unichainsepolia: "time-based",
  unichainmainnet: "time-based",
  berachainbartio: "time-based",
  isTimeBased: "time-based",
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
  },
  bsctestnet: {
    VTreasury: venusProtocolBscTestnet.VTreasury.address,
    NormalTimelock: governanceBscTestnet.NormalTimelock.address,
    FastTrackTimelock: governanceBscTestnet.FastTrackTimelock.address,
    CriticalTimelock: governanceBscTestnet.CriticalTimelock.address,
    GovernorBravo: governanceBscTestnet.GovernorBravoDelegator.address,
    AccessControlManager: governanceBscTestnet.AccessControlManager.address,
    PancakeFactory: venusProtocolBscTestnet.pancakeFactory.address,
    WBNB: venusProtocolBscTestnet.WBNB.address,
    VBNB_CorePool: venusProtocolBscTestnet.vBNB.address,
    SwapRouter_CorePool: venusProtocolBscTestnet.SwapRouterCorePool.address,
    Unitroller: venusProtocolBscTestnet.Unitroller.address,
    Shortfall: "0x503574a82fE2A9f968d355C8AAc1Ba0481859369",
  },
  bscmainnet: {
    VTreasury: venusProtocolBscMainnet.VTreasury.address,
    NormalTimelock: governanceBscMainnet.NormalTimelock.address,
    FastTrackTimelock: governanceBscMainnet.FastTrackTimelock.address,
    CriticalTimelock: governanceBscMainnet.CriticalTimelock.address,
    GovernorBravo: governanceBscMainnet.GovernorBravoDelegator.address,
    AccessControlManager: governanceBscMainnet.AccessControlManager.address,
    PancakeFactory: venusProtocolBscMainnet.pancakeFactory.address,
    WBNB: venusProtocolBscMainnet.WBNB.address,
    VBNB_CorePool: venusProtocolBscMainnet.vBNB.address,
    SwapRouter_CorePool: venusProtocolBscMainnet.SwapRouterCorePool.address,
    Unitroller: venusProtocolBscMainnet.Unitroller.address,
    Shortfall: "0xf37530A8a810Fcb501AA0Ecd0B0699388F0F2209",
  },
  sepolia: {
    VTreasury: venusProtocolSepolia.VTreasuryV8.address,
    NormalTimelock: governanceSepolia.NormalTimelock.address,
    FastTrackTimelock: governanceSepolia.FastTrackTimelock.address,
    CriticalTimelock: governanceSepolia.CriticalTimelock.address,
    AccessControlManager: governanceSepolia.AccessControlManager.address,
  },
  ethereum: {
    VTreasury: venusProtocolEthereum.VTreasuryV8.address,
    NormalTimelock: governanceEthereum.NormalTimelock.address,
    FastTrackTimelock: governanceEthereum.FastTrackTimelock.address,
    CriticalTimelock: governanceEthereum.CriticalTimelock.address,
    AccessControlManager: governanceEthereum.AccessControlManager.address,
  },
  opbnbtestnet: {
    VTreasury: venusProtocolOpbnbTestnet.VTreasuryV8.address,
    NormalTimelock: OPBNBTESTNET_MULTISIG,
    FastTrackTimelock: OPBNBTESTNET_MULTISIG,
    CriticalTimelock: OPBNBTESTNET_MULTISIG,
    AccessControlManager: governanceOpbnbTestnet.AccessControlManager.address,
  },
  opbnbmainnet: {
    VTreasury: venusProtocolOpbnbMainnet.VTreasuryV8.address,
    NormalTimelock: OPBNBMAINNET_MULTISIG,
    FastTrackTimelock: OPBNBMAINNET_MULTISIG,
    CriticalTimelock: OPBNBMAINNET_MULTISIG,
    AccessControlManager: governanceOpbnbMainnet.AccessControlManager.address,
  },
  arbitrumsepolia: {
    VTreasury: venusProtocolArbitrumSepolia.VTreasuryV8.address,
    NormalTimelock: governanceArbitrumSepolia.NormalTimelock.address,
    FastTrackTimelock: governanceArbitrumSepolia.FastTrackTimelock.address,
    CriticalTimelock: governanceArbitrumSepolia.CriticalTimelock.address,
    AccessControlManager: governanceArbitrumSepolia.AccessControlManager.address,
  },
  arbitrumone: {
    VTreasury: venusProtocolArbitrumOne.VTreasuryV8.address,
    NormalTimelock: governanceArbitrumOne.NormalTimelock.address,
    FastTrackTimelock: governanceArbitrumOne.FastTrackTimelock.address,
    CriticalTimelock: governanceArbitrumOne.CriticalTimelock.address,
    AccessControlManager: governanceArbitrumOne.AccessControlManager.address,
  },
  zksyncsepolia: {
    VTreasury: venusProtocolZkSyncSepolia.VTreasuryV8.address,
    NormalTimelock: governanceZkSyncSepolia.NormalTimelock.address,
    FastTrackTimelock: governanceZkSyncSepolia.FastTrackTimelock.address,
    CriticalTimelock: governanceZkSyncSepolia.CriticalTimelock.address,
    AccessControlManager: governanceZkSyncSepolia.AccessControlManager.address,
  },
  zksyncmainnet: {
    VTreasury: venusProtocolZkSyncMainnet.VTreasuryV8.address,
    NormalTimelock: governanceZkSyncMainnet.NormalTimelock.address,
    FastTrackTimelock: governanceZkSyncMainnet.FastTrackTimelock.address,
    CriticalTimelock: governanceZkSyncMainnet.CriticalTimelock.address,
    AccessControlManager: governanceZkSyncMainnet.AccessControlManager.address,
  },
  opsepolia: {
    VTreasury: "0x5A1a12F47FA7007C9e23cf5e025F3f5d3aC7d755",
    NormalTimelock: OP_SEPOLIA_MULTISIG,
    FastTrackTimelock: OP_SEPOLIA_MULTISIG,
    CriticalTimelock: OP_SEPOLIA_MULTISIG,
    AccessControlManager: "0x1652E12C8ABE2f0D84466F0fc1fA4286491B3BC1",
  },
  opmainnet: {
    VTreasury: "0x104c01EB7b4664551BE6A9bdB26a8C5c6Be7d3da",
    NormalTimelock: OP_MAINNET_MULTISIG,
    FastTrackTimelock: OP_MAINNET_MULTISIG,
    CriticalTimelock: OP_MAINNET_MULTISIG,
    AccessControlManager: "0xD71b1F33f6B0259683f11174EE4Ddc2bb9cE4eD6",
  },
  basesepolia: {
    VTreasury: "0x07e880DaA6572829cE8ABaaf0f5323A4eFC417A6",
    NormalTimelock: governanceBaseSepolia.NormalTimelock.address,
    FastTrackTimelock: governanceBaseSepolia.FastTrackTimelock.address,
    CriticalTimelock: governanceBaseSepolia.CriticalTimelock.address,
    AccessControlManager: "0x724138223D8F76b519fdE715f60124E7Ce51e051",
  },
  basemainnet: {
    VTreasury: "0xbefD8d06f403222dd5E8e37D2ba93320A97939D1",
    NormalTimelock: governanceBaseMainnet.NormalTimelock.address,
    FastTrackTimelock: governanceBaseMainnet.FastTrackTimelock.address,
    CriticalTimelock: governanceBaseMainnet.CriticalTimelock.address,
    AccessControlManager: "0x9E6CeEfDC6183e4D0DF8092A9B90cDF659687daB",
  },
  unichainsepolia: {
    VTreasury: "0x0C7CB62F2194cD701bcE8FD8067b43A3Bb76428e",
    NormalTimelock: "0x5e20F5A2e23463D39287185DF84607DF7068F314",
    FastTrackTimelock: UNICHAIN_SEPOLIA_MULTISIG,
    CriticalTimelock: UNICHAIN_SEPOLIA_MULTISIG,
    AccessControlManager: "0x854C064EA6b503A97980F481FA3B7279012fdeDd",
  },
  unichainmainnet: {
    VTreasury: "0x958F4C84d3ad523Fa9936Dc465A123C7AD43D69B",
    NormalTimelock: "0x918532A78d22419Da4091930d472bDdf532BE89a",
    FastTrackTimelock: UNICHAIN_MAINNET_MULTISIG,
    CriticalTimelock: UNICHAIN_MAINNET_MULTISIG,
    AccessControlManager: "0x1f12014c497a9d905155eB9BfDD9FaC6885e61d0",
  },
  berachainbartio: {
    VTreasury: "0xF2f878a9cF9a43409F673CfA17B4F1E9D8169211",
    NormalTimelock: "0x8699D418D8bae5CFdc566E4fce897B08bd9B03B0",
    FastTrackTimelock: "0x723b7CB226d86bd89638ec77936463453a46C656",
    CriticalTimelock: "0x920eeE8A5581e80Ca9C47CbF11B7A6cDB30204BD",
    AccessControlManager: "0xEf368e4c1f9ACC9241E66CD67531FEB195fF7536",
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
  berachainbartio: {
    preconfiguredAddresses: preconfiguredAddresses.berachainbartio,
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
    case "berachainbartio":
      return globalConfig.berachainbartio;
    case "development":
      return globalConfig.bsctestnet;
    default:
      throw new Error(`config for network ${networkName} is not available.`);
  }
}
