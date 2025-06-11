// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

import { VenusERC4626 } from "./Base/VenusERC4626.sol";
import { VToken } from "@venusprotocol/isolated-pools/contracts/VToken.sol";
import { RewardsDistributor } from "@venusprotocol/isolated-pools/contracts/Rewards/RewardsDistributor.sol";
import { MaxLoopsLimitHelper } from "@venusprotocol/isolated-pools/contracts/MaxLoopsLimitHelper.sol";
import { IProtocolShareReserve } from "./Interfaces/IProtocolShareReserve.sol";

/// @title VenusERC4626Isolated
/// @notice ERC4626 wrapper for Venus Isolated Pool vTokens
contract VenusERC4626Isolated is VenusERC4626, MaxLoopsLimitHelper {
    using MaxLoopsLimitHelper for uint256;

    /// @notice The Venus vToken associated with this ERC4626 vault.
    VToken public vToken;

    /// @notice Sets the maximum loops limit
    function setMaxLoopsLimit(uint256 loopsLimit) external {
        _checkAccessAllowed("setMaxLoopsLimit(uint256)");
        _setMaxLoopsLimit(loopsLimit);
    }

    /// @inheritdoc VenusERC4626
    function claimRewards() external override {
        IComptroller _comptroller = comptroller;
        VToken _vToken = vToken;
        address _rewardRecipient = rewardRecipient;

        RewardsDistributor[] memory rewardDistributors = _comptroller.getRewardDistributors();

        _ensureMaxLoops(rewardDistributors.length);

        for (uint256 i = 0; i < rewardDistributors.length; i++) {
            RewardsDistributor rewardDistributor = rewardDistributors[i];
            IERC20Upgradeable rewardToken = IERC20Upgradeable(address(rewardDistributor.rewardToken()));

            VToken[] memory vTokens = new VToken[](1);
            vTokens[0] = _vToken;
            rewardDistributor.claimRewardToken(address(this), vTokens);
            uint256 rewardBalance = rewardToken.balanceOf(address(this));

            if (rewardBalance > 0) {
                SafeERC20Upgradeable.safeTransfer(rewardToken, _rewardRecipient, rewardBalance);

                try
                    IProtocolShareReserve(_rewardRecipient).updateAssetsState(
                        address(_comptroller),
                        address(rewardToken),
                        IProtocolShareReserve.IncomeType.ERC4626_WRAPPER_REWARDS
                    )
                {} catch {}

                emit ClaimRewards(rewardBalance, address(rewardToken));
            }
        }
    }

    /// @notice Initializes the isolated pool vault with additional parameters
    function initialize2(
        address accessControlManager_,
        address rewardRecipient_,
        uint256 loopsLimit_,
        address vaultOwner_
    ) public override reinitializer(2) {
        ensureNonzeroAddress(vaultOwner_);

        __AccessControlled_init(accessControlManager_);
        _setMaxLoopsLimit(loopsLimit_);
        _setRewardRecipient(rewardRecipient_);
        _transferOwnership(vaultOwner_);
    }

    /// @inheritdoc VenusERC4626
    function _initializeVToken(address vToken_) internal override {
        vToken = VToken(vToken_);
        comptroller = IComptroller(address(vToken.comptroller()));
    }

    /// @inheritdoc VenusERC4626
    function _getUnderlying(address vToken_) internal view override returns (address) {
        return VToken(vToken_).underlying();
    }
}
