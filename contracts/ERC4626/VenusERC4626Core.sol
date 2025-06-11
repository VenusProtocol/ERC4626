// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

import { VenusERC4626 } from "./VenusERC4626.sol";
import { VTokenInterface } from "./Interfaces/VTokenInterface.sol";
import { IProtocolShareReserve } from "./Interfaces/IProtocolShareReserve.sol";

/// @title VenusERC4626Core
/// @notice ERC4626 wrapper for Venus Core Pool vTokens
contract VenusERC4626Core is VenusERC4626 {
    /// @notice The Venus vToken associated with this ERC4626 vault.
    VTokenInterface public vToken;

    /// @inheritdoc VenusERC4626
    function claimRewards() external override {
        comptroller.claimVenus(address(this));

        address xvsAddress = comptroller.getXVSAddress();
        IERC20Upgradeable xvs = IERC20Upgradeable(xvsAddress);
        uint256 rewardAmount = xvs.balanceOf(address(this));

        if (rewardAmount > 0) {
            SafeERC20Upgradeable.safeTransfer(xvs, rewardRecipient, rewardAmount);

            bytes memory data = abi.encodeCall(
                IProtocolShareReserve.updateAssetsState,
                (address(comptroller), xvsAddress, IProtocolShareReserve.IncomeType.ERC4626_WRAPPER_REWARDS)
            );
            rewardRecipient.call(data);

            emit ClaimRewards(rewardAmount, xvsAddress);
        }
    }

    /// @inheritdoc VenusERC4626
    function _initializeVToken(address vToken_) internal override {
        vToken = VTokenInterface(vToken_);
        comptroller = IComptroller(address(vToken.comptroller()));
    }

    /// @inheritdoc VenusERC4626
    function _getUnderlying(address vToken_) internal view override returns (address) {
        return VTokenInterface(vToken_).underlying();
    }
}
