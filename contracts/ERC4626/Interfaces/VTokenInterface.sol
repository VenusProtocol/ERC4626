pragma solidity 0.8.25;

import { IComptroller } from "./IComptroller.sol";

interface VTokenInterface {
    function mint(uint256 mintAmount) external returns (uint256);

    function redeem(uint256 redeemTokens) external returns (uint256);

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    function balanceOf(address owner) external view returns (uint256);

    function comptroller() external view returns (IComptroller);

    function totalSupply() external view returns (uint256);

    function underlying() external view returns (address);

    function getCash() external view returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function accrueInterest() external view returns (uint256);

    function totalReserves() external view returns (uint256);
}
