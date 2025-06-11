import { deployments, getNamedAccounts } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { DeploymentInfo, blocksPerYear } from "./deploymentConfig";

export const toAddress = async (addressOrAlias: string): Promise<string> => {
  if (addressOrAlias.startsWith("0x")) {
    return addressOrAlias;
  }
  if (addressOrAlias.startsWith("account:")) {
    const namedAccounts = await getNamedAccounts();
    return namedAccounts[addressOrAlias.slice("account:".length)];
  }
  const deployment = await deployments.get(addressOrAlias);
  return deployment.address;
};

export const getBlockOrTimestampBasedDeploymentInfo = (network: string): DeploymentInfo => {
  const blocksPerYear_ = blocksPerYear[network];
  if (blocksPerYear_ === "time-based") {
    return { isTimeBased: true, blocksPerYear: 0 };
  }
  return { isTimeBased: false, blocksPerYear: blocksPerYear_ };
};

export const skipMainnets = () => async (hre: HardhatRuntimeEnvironment) => {
  const isMainnet = hre.network.live && !hre.network.tags["testnet"];
  return isMainnet;
};
