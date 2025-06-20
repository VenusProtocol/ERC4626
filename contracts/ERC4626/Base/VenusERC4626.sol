// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ERC4626Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { MathUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";

import { IComptroller, Action } from "../Interfaces/IComptroller.sol";
import { VTokenInterface } from "../Interfaces/VTokenInterface.sol";

uint256 constant EXP_SCALE = 1e18;

/// @title VenusERC4626
/// @notice Abstract ERC4626 wrapper for Venus vTokens
abstract contract VenusERC4626 is ERC4626Upgradeable, AccessControlledV8, ReentrancyGuardUpgradeable {
    using MathUpgradeable for uint256;
    using SafeERC20Upgradeable for ERC20Upgradeable;

    /// @notice Error code representing no errors in Venus operations.
    uint256 internal constant NO_ERROR = 0;

    /// @notice The Venus vToken associated with this ERC4626 vault.
    VTokenInterface public vToken;

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
        _disableInitializers();
    }

    /// @notice Initializes the VenusERC4626 vault with the VToken address
    /// @param vToken_ The VToken associated with the vault
    function initialize(address vToken_) public virtual initializer {
        ensureNonzeroAddress(vToken_);

        vToken = VTokenInterface(vToken_);
        comptroller = IComptroller(address(vToken.comptroller()));
        ERC20Upgradeable asset = ERC20Upgradeable(vToken.underlying());

        __ERC20_init(_generateVaultName(asset), _generateVaultSymbol(asset));
        __ERC4626_init(asset);
        __ReentrancyGuard_init();
    }

    /// @notice Sets a new reward recipient address
    /// @param newRecipient The address of the new reward recipient
    function setRewardRecipient(address newRecipient) external virtual {
        _checkAccessAllowed("setRewardRecipient(address)");
        _setRewardRecipient(newRecipient);
    }

    /// @notice Sweeps tokens from the contract to the owner
    /// @param token Address of the token to sweep
    function sweepToken(IERC20Upgradeable token) external virtual onlyOwner {
        uint256 balance = token.balanceOf(address(this));

        if (balance > 0) {
            address owner_ = owner();
            SafeERC20Upgradeable.safeTransfer(token, owner_, balance);
            emit SweepToken(address(token), owner_, balance);
        }
    }

    /// @notice Claims rewards from the Venus protocol
    /// @dev Must be implemented by child contracts
    function claimRewards() external virtual;

    /// @notice Second initialization function to complete vault configuration
    /// @param accessControlManager_ Address of the ACM contract
    /// @param rewardRecipient_ Address that will receive rewards
    /// @param vaultOwner_ Owner of the vault
    function initialize2(
        address accessControlManager_,
        address rewardRecipient_,
        address vaultOwner_
    ) public virtual reinitializer(2) {
        ensureNonzeroAddress(vaultOwner_);

        __AccessControlled_init(accessControlManager_);
        _setRewardRecipient(rewardRecipient_);
        _transferOwnership(vaultOwner_);
    }

    /// @inheritdoc ERC4626Upgradeable
    function deposit(uint256 assets, address receiver) public virtual override nonReentrant returns (uint256) {
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
    function mint(uint256 shares, address receiver) public virtual override nonReentrant returns (uint256) {
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
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override nonReentrant returns (uint256) {
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
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override nonReentrant returns (uint256) {
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

    /// @inheritdoc ERC4626Upgradeable
    function totalAssets() public view virtual override returns (uint256) {
        return (vToken.balanceOf(address(this)) * vToken.exchangeRateStored()) / EXP_SCALE;
    }

    /// @inheritdoc ERC4626Upgradeable
    function maxDeposit(address /*account*/) public view virtual override returns (uint256) {
        if (comptroller.actionPaused(address(vToken), Action.MINT)) {
            return 0;
        }

        uint256 supplyCap = comptroller.supplyCaps(address(vToken));
        uint256 totalSupply_ = (vToken.totalSupply() * vToken.exchangeRateStored()) / EXP_SCALE;
        return supplyCap > totalSupply_ ? supplyCap - totalSupply_ : 0;
    }

    /// @inheritdoc ERC4626Upgradeable
    function maxMint(address /*account*/) public view virtual override returns (uint256) {
        return convertToShares(maxDeposit(address(0)));
    }

    /// @inheritdoc ERC4626Upgradeable
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

    /// @inheritdoc ERC4626Upgradeable
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

    /// @notice Internal function to redeem shares
    function _beforeRedeem(uint256 shares) internal virtual returns (uint256) {
        IERC20Upgradeable token = IERC20Upgradeable(asset());
        uint256 balanceBefore = token.balanceOf(address(this));

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

        return balanceAfter - balanceBefore;
    }

    /// @notice Internal function to handle withdrawals
    function _beforeWithdraw(uint256 assets) internal virtual returns (uint256 actualAssets, uint256 actualShares) {
        IERC20Upgradeable token = IERC20Upgradeable(asset());
        uint256 balanceBefore = token.balanceOf(address(this));
        uint256 vTokenBalanceBefore = vToken.balanceOf(address(this));

        uint256 errorCode = vToken.redeemUnderlying(assets);
        if (errorCode != NO_ERROR) {
            revert VenusERC4626__VenusError(errorCode);
        }

        actualAssets = token.balanceOf(address(this)) - balanceBefore;

        uint256 actualVTokens = vTokenBalanceBefore - vToken.balanceOf(address(this));
        if (actualVTokens == 0) {
            revert ERC4626__ZeroAmount("actualVTokens at _beforeWithdraw");
        }
        actualShares = actualVTokens.mulDiv(
            totalSupply() + 10 ** _decimalsOffset(),
            vTokenBalanceBefore,
            MathUpgradeable.Rounding.Up
        );
    }

    /// @notice Internal function to mint vTokens
    function _mintVTokens(uint256 assets) internal virtual {
        ERC20Upgradeable(asset()).safeApprove(address(vToken), assets);
        uint256 errorCode = vToken.mint(assets);
        if (errorCode != NO_ERROR) {
            revert VenusERC4626__VenusError(errorCode);
        }
    }

    /// @notice Internal function to set reward recipient
    function _setRewardRecipient(address newRecipient) internal virtual {
        ensureNonzeroAddress(newRecipient);

        emit RewardRecipientUpdated(rewardRecipient, newRecipient);
        rewardRecipient = newRecipient;
    }

    /// @inheritdoc ERC4626Upgradeable
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal virtual override {
        uint256 assetBalanceBefore = IERC20Upgradeable(asset()).balanceOf(address(this));
        uint256 vTokenBalanceBefore = vToken.balanceOf(address(this));

        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(asset()), caller, address(this), assets);

        uint256 assetsReceived = IERC20Upgradeable(asset()).balanceOf(address(this)) - assetBalanceBefore;
        _mintVTokens(assetsReceived);

        uint256 vTokensReceived = vToken.balanceOf(address(this)) - vTokenBalanceBefore;
        if (vTokensReceived == 0) {
            revert ERC4626__ZeroAmount("vTokensReceived at _deposit");
        }
        uint256 actualAssetsValue = (vTokensReceived * vToken.exchangeRateStored()) / EXP_SCALE;

        uint256 actualShares = actualAssetsValue.mulDiv(
            totalSupply() + 10 ** _decimalsOffset(),
            totalAssets() + 1 - actualAssetsValue,
            MathUpgradeable.Rounding.Down
        );

        _mint(receiver, actualShares);

        emit Deposit(caller, receiver, assets, actualShares);
    }

    /// @inheritdoc ERC4626Upgradeable
    function _decimalsOffset() internal view virtual override returns (uint8) {
        return 18 - ERC20Upgradeable(asset()).decimals();
    }

    /// @notice Generates vault name
    function _generateVaultName(ERC20Upgradeable asset_) internal view virtual returns (string memory) {
        return string(abi.encodePacked("ERC4626-Wrapped Venus ", asset_.name()));
    }

    /// @notice Generates vault symbol
    function _generateVaultSymbol(ERC20Upgradeable asset_) internal view virtual returns (string memory) {
        return string(abi.encodePacked("v4626", asset_.symbol()));
    }
}
