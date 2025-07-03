// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { VenusERC4626 } from "./Base/VenusERC4626.sol";
import { IERC20Upgradeable, SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IProtocolShareReserve } from "./Interfaces/IProtocolShareReserve.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

/// @title VenusERC4626Core
/// @notice ERC4626 wrapper for Venus Core Pool vTokens
contract VenusERC4626Core is VenusERC4626 {
    /// @notice Immutable XVS token address
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable XVS_ADDRESS;

    /// @notice Constructor
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address xvsAddress_) {
        ensureNonzeroAddress(xvsAddress_);
        XVS_ADDRESS = xvsAddress_;
        _disableInitializers();
    }

    /// @notice Initializes the VenusERC4626Core contract
    /// @param vToken_ The address of the vToken to be wrapped
    function initialize(address vToken_) public virtual override initializer {
        super.initialize(vToken_);
    }

    /// @inheritdoc VenusERC4626
    function claimRewards() external override {
        comptroller.claimVenus(address(this));

        IERC20Upgradeable xvs = IERC20Upgradeable(XVS_ADDRESS);
        uint256 rewardAmount = xvs.balanceOf(address(this));

        if (rewardAmount > 0) {
            SafeERC20Upgradeable.safeTransfer(xvs, rewardRecipient, rewardAmount);

            bytes memory data = abi.encodeCall(
                IProtocolShareReserve.updateAssetsState,
                (address(comptroller), XVS_ADDRESS, IProtocolShareReserve.IncomeType.ERC4626_WRAPPER_REWARDS)
            );
            rewardRecipient.call(data);

            emit ClaimRewards(rewardAmount, XVS_ADDRESS);
        }
    }
}
