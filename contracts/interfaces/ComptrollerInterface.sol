pragma solidity ^0.8.25;

import { RewardsDistributor } from "@venusprotocol/isolated-pools/contracts/Rewards/RewardsDistributor.sol";

enum Action {
    MINT,
    REDEEM,
    BORROW,
    REPAY,
    SEIZE,
    LIQUIDATE,
    TRANSFER,
    ENTER_MARKET,
    EXIT_MARKET
}

interface ComptrollerInterface {
    function claimVenus(address) external;

    function actionPaused(address market, Action action) external view returns (bool);

    function getRewardDistributors() external view returns (RewardsDistributor[] memory);

    function supplyCaps(address) external view returns (uint256);

    function markets(address) external view returns (bool, uint);

    function getXVSAddress() external view returns (address);
}
