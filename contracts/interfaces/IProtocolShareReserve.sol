// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

interface IProtocolShareReserve {
    enum IncomeType {
        SPREAD,
        LIQUIDATION,
        ERC4626_WRAPPER_REWARDS
    }

    function updateAssetsState(address comptroller, address asset, IncomeType kind) external;
}
