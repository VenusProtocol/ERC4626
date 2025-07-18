// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ERC4626Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { MathUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

import { IProtocolShareReserve } from "./Interfaces/IProtocolShareReserve.sol";
import { RewardsDistributor } from "@venusprotocol/isolated-pools/contracts/Rewards/RewardsDistributor.sol";
import { MaxLoopsLimitHelper } from "@venusprotocol/isolated-pools/contracts/MaxLoopsLimitHelper.sol";
import { IComptroller } from "./Interfaces/IComptroller.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { Action } from "@venusprotocol/isolated-pools/contracts/ComptrollerInterface.sol";
import { EXP_SCALE } from "@venusprotocol/isolated-pools/contracts/lib/constants.sol";
import { VToken } from "@venusprotocol/isolated-pools/contracts/VToken.sol";

/// @title VenusERC4626
/// @notice ERC4626 wrapper for Venus vTokens, enabling standard ERC4626 vault interactions with Venus Protocol.
contract VenusERC4626 is ERC4626Upgradeable, AccessControlledV8, MaxLoopsLimitHelper, ReentrancyGuardUpgradeable {
    using MathUpgradeable for uint256;
    using SafeERC20Upgradeable for ERC20Upgradeable;

    /// @notice Error code representing no errors in Venus operations.
    uint256 internal constant NO_ERROR = 0;

    /// @notice The Venus vToken associated with this ERC4626 vault.
    VToken public vToken;

    /// @notice The Venus Comptroller contract, responsible for market operations.
    IComptroller public comptroller;

    /// @notice The recipient of rewards distributed by the Venus Protocol.
    address public rewardRecipient;

    /// @notice Emitted when rewards are claimed.
    /// @param amount The amount of reward tokens claimed.
    /// @param rewardToken The address of the reward token claimed.
    event ClaimRewards(uint256 amount, address indexed rewardToken);

    /// @notice Emitted when the reward recipient address is updated.
    /// @param oldRecipient The previous reward recipient address.
    /// @param newRecipient The new reward recipient address.
    event RewardRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    /// @notice Event emitted when tokens are swept
    event SweepToken(address indexed token, address indexed receiver, uint256 amount);

    /// @notice Thrown when a Venus protocol call returns an error.
    /// @dev This error is triggered if a Venus operation (such as minting or redeeming vTokens) fails.
    /// @param errorCode The error code returned by the Venus protocol.
    error VenusERC4626__VenusError(uint256 errorCode);

    /// @notice Thrown when a deposit exceeds the maximum allowed limit.
    /// @dev This error is triggered if the deposit amount is greater than `maxDeposit(receiver)`.
    error ERC4626__DepositMoreThanMax();

    /// @notice Thrown when a mint operation exceeds the maximum allowed limit.
    /// @dev This error is triggered if the mint amount is greater than `maxMint(receiver)`.
    error ERC4626__MintMoreThanMax();

    /// @notice Thrown when a withdrawal exceeds the maximum available assets.
    /// @dev This error is triggered if the withdrawal amount is greater than `maxWithdraw(owner)`.
    error ERC4626__WithdrawMoreThanMax();

    /// @notice Thrown when a redemption exceeds the maximum redeemable shares.
    /// @dev This error is triggered if the redemption amount is greater than `maxRedeem(owner)`.
    error ERC4626__RedeemMoreThanMax();

    /// @notice Thrown when attempting an operation with a zero amount.
    /// @dev This error prevents unnecessary transactions with zero amounts in deposit, withdraw, mint, or redeem operations.
    /// @param operation The name of the operation that failed (e.g., "deposit", "withdraw", "mint", "redeem").
    error ERC4626__ZeroAmount(string operation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Note that the contract is upgradeable. Use initialize() or reinitializers
        // to set the state variables.
        _disableInitializers();
    }

    /// @notice Initializes the VenusERC4626 vault, only with the VToken address associated to the vault
    /// @dev `initialize2` should be invoked to complete the configuration of the vault
    /// @param vToken_ The VToken associated with the vault, representing the yield-bearing asset.
    function initialize(address vToken_) public initializer {
        ensureNonzeroAddress(vToken_);

        vToken = VToken(vToken_);
        comptroller = IComptroller(address(vToken.comptroller()));
        ERC20Upgradeable asset = ERC20Upgradeable(vToken.underlying());

        __ERC20_init(_generateVaultName(asset), _generateVaultSymbol(asset));
        __ERC4626_init(asset);
        __ReentrancyGuard_init();
    }

    /**
     * @notice Set the limit for the loops can iterate to avoid the DOS
     * @param loopsLimit Number of loops limit
     * @custom:event Emits MaxLoopsLimitUpdated event on success
     * @custom:access Controlled by ACM
     */
    function setMaxLoopsLimit(uint256 loopsLimit) external {
        _checkAccessAllowed("setMaxLoopsLimit(uint256)");
        _setMaxLoopsLimit(loopsLimit);
    }

    /// @notice Sets a new reward recipient address
    /// @param newRecipient The address of the new reward recipient
    /// @custom:access Controlled by ACM
    function setRewardRecipient(address newRecipient) external {
        _checkAccessAllowed("setRewardRecipient(address)");
        _setRewardRecipient(newRecipient);
    }

    /// @notice Sweeps the input token address tokens from the contract and sends them to the owner
    /// @param token Address of the token
    /// @custom:event SweepToken emits on success
    /// @custom:access Only owner
    function sweepToken(IERC20Upgradeable token) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));

        if (balance > 0) {
            address owner_ = owner();
            SafeERC20Upgradeable.safeTransfer(token, owner_, balance);
            emit SweepToken(address(token), owner_, balance);
        }
    }

    /// @notice Claims rewards from all reward distributors associated with the VToken and transfers them to the reward recipient.
    /// @dev Iterates through all reward distributors fetched from the comptroller, claims rewards, and transfers them if available.
    function claimRewards() external {
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
            RewardsDistributor(rewardDistributor).claimRewardToken(address(this), vTokens);
            uint256 rewardBalance = rewardToken.balanceOf(address(this));

            if (rewardBalance > 0) {
                SafeERC20Upgradeable.safeTransfer(rewardToken, _rewardRecipient, rewardBalance);

                // Try to update the asset state on the recipient if reward recipient is a protocol share reserve
                // reward recipient cannot be an EOA
                try
                    IProtocolShareReserve(_rewardRecipient).updateAssetsState(
                        address(_comptroller),
                        address(rewardToken),
                        IProtocolShareReserve.IncomeType.ERC4626_WRAPPER_REWARDS
                    )
                {} catch {}
            }
            emit ClaimRewards(rewardBalance, address(rewardToken));
        }
    }

    /// @notice Second function to invoke to complete the configuration of the vault, setting the rest of the attributes
    /// @param accessControlManager_ Address of the ACM contract
    /// @param rewardRecipient_ The address that will receive rewards generated by the vault.
    /// @param loopsLimit_ The maximum number of loops allowed for reward distribution.
    /// @param vaultOwner_ The owner that will be set for the created vault
    function initialize2(
        address accessControlManager_,
        address rewardRecipient_,
        uint256 loopsLimit_,
        address vaultOwner_
    ) public reinitializer(2) {
        ensureNonzeroAddress(vaultOwner_);

        __AccessControlled_init(accessControlManager_);
        _setMaxLoopsLimit(loopsLimit_);
        _setRewardRecipient(rewardRecipient_);
        _transferOwnership(vaultOwner_);
    }

    /// @inheritdoc ERC4626Upgradeable
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256) {
        ensureNonzeroAddress(receiver);

        vToken.accrueInterest();
        if (assets == 0) {
            revert ERC4626__ZeroAmount("deposit");
        }
        if (assets > maxDeposit(receiver)) {
            revert ERC4626__DepositMoreThanMax();
        }

        uint256 shares = previewDeposit(assets);
        if (shares == 0) {
            revert ERC4626__ZeroAmount("deposit");
        }

        uint256 totalSupplyBefore = totalSupply();
        _deposit(_msgSender(), receiver, assets, shares);
        uint256 actualShares = totalSupply() - totalSupplyBefore;

        return actualShares;
    }

    /// @dev The minted shares are calculated considering the minted VTokens
    /// @dev It can mint slightly fewer shares than requested, because VToken.mint rounds down
    /// @inheritdoc ERC4626Upgradeable
    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
        ensureNonzeroAddress(receiver);

        vToken.accrueInterest();
        if (shares == 0) {
            revert ERC4626__ZeroAmount("mint");
        }
        if (shares > maxMint(receiver)) {
            revert ERC4626__MintMoreThanMax();
        }
        uint256 assets = previewMint(shares);
        if (assets == 0) {
            revert ERC4626__ZeroAmount("mint");
        }
        _deposit(_msgSender(), receiver, assets, shares);
        return assets;
    }

    /// @dev Receiver can receive slightly more assets than requested, because VToken.redeemUnderlying rounds up
    /// @dev The shares to burn are calculated considering the actual transferred assets, not the requested ones
    /// @inheritdoc ERC4626Upgradeable
    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
        ensureNonzeroAddress(receiver);
        ensureNonzeroAddress(owner);

        vToken.accrueInterest();
        if (assets == 0) {
            revert ERC4626__ZeroAmount("withdraw");
        }
        if (assets > maxWithdraw(owner)) {
            revert ERC4626__WithdrawMoreThanMax();
        }

        (uint256 actualAssets, uint256 actualShares) = _beforeWithdraw(assets);
        _withdraw(_msgSender(), receiver, owner, actualAssets, actualShares);

        return actualShares;
    }

    /// @inheritdoc ERC4626Upgradeable
    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        ensureNonzeroAddress(receiver);
        ensureNonzeroAddress(owner);

        vToken.accrueInterest();
        if (shares == 0) {
            revert ERC4626__ZeroAmount("redeem");
        }
        if (shares > maxRedeem(owner)) {
            revert ERC4626__RedeemMoreThanMax();
        }

        uint256 actualAssets = _beforeRedeem(shares);
        if (actualAssets == 0) {
            revert ERC4626__ZeroAmount("redeem");
        }

        _withdraw(_msgSender(), receiver, owner, actualAssets, shares);
        return actualAssets;
    }

    /// @notice Returns the total amount of assets deposited
    /// @return Amount of assets deposited
    function totalAssets() public view virtual override returns (uint256) {
        return (vToken.balanceOf(address(this)) * vToken.exchangeRateStored()) / EXP_SCALE;
    }

    /// @notice Returns the maximum deposit allowed based on Venus supply caps.
    /// @dev If minting is paused or the supply cap is reached, returns 0.
    /// @param /*account*/ The address of the account.
    /// @return The maximum amount of assets that can be deposited.
    function maxDeposit(address /*account*/) public view virtual override returns (uint256) {
        if (comptroller.actionPaused(address(vToken), Action.MINT)) {
            return 0;
        }

        uint256 supplyCap = comptroller.supplyCaps(address(vToken));
        uint256 totalSupply_ = (vToken.totalSupply() * vToken.exchangeRateStored()) / EXP_SCALE;
        return supplyCap > totalSupply_ ? supplyCap - totalSupply_ : 0;
    }

    /// @notice Returns the maximum amount of shares that can be minted.
    /// @dev This is derived from the maximum deposit amount converted to shares.
    /// @param /*account*/ The address of the account.
    /// @return The maximum number of shares that can be minted.
    function maxMint(address /*account*/) public view virtual override returns (uint256) {
        return convertToShares(maxDeposit(address(0)));
    }

    /// @notice Returns the maximum amount that can be withdrawn.
    /// @dev The withdrawable amount is limited by the available cash in the vault.
    /// @param receiver The address of the account withdrawing.
    /// @return The maximum amount of assets that can be withdrawn.
    function maxWithdraw(address receiver) public view virtual override returns (uint256) {
        if (comptroller.actionPaused(address(vToken), Action.REDEEM)) {
            return 0;
        }

        uint256 cash = vToken.getCash();
        uint256 totalReserves = vToken.totalReserves();
        uint256 assetsBalance = convertToAssets(balanceOf(receiver));

        if (cash < totalReserves) {
            return 0;
        } else {
            uint256 availableCash = cash - totalReserves;
            return availableCash < assetsBalance ? availableCash : assetsBalance;
        }
    }

    /// @notice Returns the maximum amount of shares that can be redeemed.
    /// @dev Redemption is limited by the available cash in the vault.
    /// @param receiver The address of the account redeeming.
    /// @return The maximum number of shares that can be redeemed.
    function maxRedeem(address receiver) public view virtual override returns (uint256) {
        if (comptroller.actionPaused(address(vToken), Action.REDEEM)) {
            return 0;
        }

        uint256 cash = vToken.getCash();
        uint256 totalReserves = vToken.totalReserves();
        if (cash < totalReserves) {
            return 0;
        } else {
            uint256 availableCash = cash - totalReserves;
            uint256 availableCashInShares = convertToShares(availableCash);
            uint256 shareBalance = balanceOf(receiver);
            return availableCashInShares < shareBalance ? availableCashInShares : shareBalance;
        }
    }

    /// @notice Redeems the amount of vTokens equivalent to the provided shares.
    /// @dev Calls `redeem` on the vToken contract. Reverts on error.
    /// @param shares The amount of shares to redeem.
    /// @return The amount of assets transferred in
    function _beforeRedeem(uint256 shares) internal returns (uint256) {
        IERC20Upgradeable token = IERC20Upgradeable(asset());
        uint256 balanceBefore = token.balanceOf(address(this));

        // Calculate the amount of vTokens equivalent to the amount of shares, rounding it down
        uint256 vTokens = shares.mulDiv(
            vToken.balanceOf(address(this)),
            totalSupply() + 10 ** _decimalsOffset(),
            MathUpgradeable.Rounding.Down
        );

        uint256 errorCode = vToken.redeem(vTokens);
        if (errorCode != NO_ERROR) {
            revert VenusERC4626__VenusError(errorCode);
        }

        uint256 balanceAfter = token.balanceOf(address(this));

        // Return the amount of assets that was *actually* transferred in
        return balanceAfter - balanceBefore;
    }

    /// @notice Redeems underlying assets before withdrawing from the vault.
    /// @dev Calls `redeemUnderlying` on the vToken contract. Reverts on error.
    /// @param assets The amount of underlying assets to redeem.
    /// @return actualAssets The amount of assets transferred in
    /// @return actualShares The shares equivalent to `actualAssets`, to be burned, rounded up
    /// @custom:error ERC4626__ZeroAmount is thrown when the redeemed VTokens are zero
    function _beforeWithdraw(uint256 assets) internal returns (uint256 actualAssets, uint256 actualShares) {
        IERC20Upgradeable token = IERC20Upgradeable(asset());
        uint256 balanceBefore = token.balanceOf(address(this));
        uint256 vTokenBalanceBefore = vToken.balanceOf(address(this));

        uint256 errorCode = vToken.redeemUnderlying(assets);
        if (errorCode != NO_ERROR) {
            revert VenusERC4626__VenusError(errorCode);
        }

        // Return the amount of assets *actually* transferred in
        actualAssets = token.balanceOf(address(this)) - balanceBefore;

        uint256 actualVTokens = vTokenBalanceBefore - vToken.balanceOf(address(this));
        if (actualVTokens == 0) {
            revert ERC4626__ZeroAmount("actualVTokens at _beforeWithdraw");
        }
        // Return the shares equivalent to the burned vTokens
        actualShares = actualVTokens.mulDiv(
            totalSupply() + 10 ** _decimalsOffset(),
            vTokenBalanceBefore,
            MathUpgradeable.Rounding.Up
        );
    }

    /// @notice Mints vTokens after depositing assets.
    /// @dev Calls `mint` on the vToken contract. Reverts on error.
    /// @param assets The amount of underlying assets to deposit.
    function _mintVTokens(uint256 assets) internal {
        ERC20Upgradeable(asset()).safeApprove(address(vToken), assets);
        uint256 errorCode = vToken.mint(assets);
        if (errorCode != NO_ERROR) {
            revert VenusERC4626__VenusError(errorCode);
        }
    }

    /// @notice Sets a new reward recipient address
    /// @param newRecipient The address of the new reward recipient
    /// @custom:error ZeroAddressNotAllowed is thrown when the new recipient address is zero
    /// @custom:event RewardRecipientUpdated is emitted when the reward recipient address is updated
    function _setRewardRecipient(address newRecipient) internal {
        ensureNonzeroAddress(newRecipient);

        emit RewardRecipientUpdated(rewardRecipient, newRecipient);
        rewardRecipient = newRecipient;
    }

    /// @notice Deposits the assets into the VToken and calculates the shares to mint based on the
    /// underlying assets equivalent to the new VTokens minted
    /// @custom:error ERC4626__ZeroAmount is thrown when the minted VTokens are zero
    /// @inheritdoc ERC4626Upgradeable
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        // 1. Track pre-transfer balances
        uint256 assetBalanceBefore = IERC20Upgradeable(asset()).balanceOf(address(this));
        uint256 vTokenBalanceBefore = vToken.balanceOf(address(this));

        // 2. Perform asset transfer (original OZ 4626 logic)
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(asset()), caller, address(this), assets);

        // 3. Calculate actual assets received (protects against fee-on-transfer)
        uint256 assetsReceived = IERC20Upgradeable(asset()).balanceOf(address(this)) - assetBalanceBefore;

        // 4. Mint vTokens with received assets
        _mintVTokens(assetsReceived);

        // 5. Verify actual vTokens received
        uint256 vTokensReceived = vToken.balanceOf(address(this)) - vTokenBalanceBefore;
        if (vTokensReceived == 0) {
            revert ERC4626__ZeroAmount("vTokensReceived at _deposit");
        }
        uint256 actualAssetsValue = (vTokensReceived * vToken.exchangeRateStored()) / EXP_SCALE;

        // 6. Recalculate shares based on actual received value
        // This is the same operation performed by previewDeposit, adjusting the total assets
        uint256 actualShares = actualAssetsValue.mulDiv(
            totalSupply() + 10 ** _decimalsOffset(),
            totalAssets() + 1 - actualAssetsValue, // remove the new assets deposited to the VToken in this operation
            MathUpgradeable.Rounding.Down
        );

        // 7. Mint the corrected share amount
        _mint(receiver, actualShares);

        emit Deposit(caller, receiver, assets, actualShares);
    }

    /// @notice Override `_decimalsOffset` to normalize decimals to 18 for all VenusERC4626 vaults.
    /// @return Gap between 18 and the decimals of the asset token
    function _decimalsOffset() internal view virtual override returns (uint8) {
        return 18 - ERC20Upgradeable(asset()).decimals();
    }

    /// @notice Generates and returns the derived name of the vault considering the asset name
    /// @param asset_ Asset to be accepted in the vault whose name this function will return
    /// @return Name of the vault considering the asset name
    function _generateVaultName(ERC20Upgradeable asset_) internal view returns (string memory) {
        return string(abi.encodePacked("ERC4626-Wrapped Venus ", asset_.name()));
    }

    /// @notice Generates and returns the derived symbol of the vault considering the asset symbol
    /// @param asset_ Asset to be accepted in the vault whose symbol this function will return
    /// @return Symbol of the vault considering the asset name
    function _generateVaultSymbol(ERC20Upgradeable asset_) internal view returns (string memory) {
        return string(abi.encodePacked("v4626", asset_.symbol()));
    }
}
