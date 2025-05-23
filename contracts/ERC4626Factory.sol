// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.25;

import { ERC4626Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { ComptrollerInterface } from "./interfaces/ComptrollerInterface.sol";
import { VenusERC4626Core } from "./VenusERC4626Core.sol";
import { VenusERC4626Isolated } from "./VenusERC4626Isolated.sol";

import { PoolRegistryInterface } from "@venusprotocol/isolated-pools/contracts/Pool/PoolRegistryInterface.sol";
import { MaxLoopsLimitHelper } from "@venusprotocol/isolated-pools/contracts/MaxLoopsLimitHelper.sol";
import { VTokenInterface as IsolatedVTokenInterface } from "@venusprotocol/isolated-pools/contracts/VTokenInterfaces.sol";

/// @title ERC4626Factory
/// @notice Factory contract for deploying ERC4626 vaults (core and isolated) with beacon proxies.
contract ERC4626Factory is AccessControlledV8, MaxLoopsLimitHelper {
    // --- Constants ---

    /// @notice Salt used to deterministically deploy isolated pool vaults
    bytes32 public constant ISOLATED_SALT = keccak256("Venus-Isolated-ERC4626");

    /// @notice Salt used to deterministically deploy core pool vaults
    bytes32 public constant CORE_SALT = keccak256("Venus-Core-ERC4626");

    // --- State Variables ---

    /// @notice Beacon for isolated vaults
    UpgradeableBeacon public isolatedBeacon;

    /// @notice Beacon for core vaults
    UpgradeableBeacon public coreBeacon;

    /// @notice PoolRegistry contract to validate isolated pool vTokens
    PoolRegistryInterface public poolRegistry;

    /// @notice Comptroller for core pool validation
    ComptrollerInterface public coreComptroller;

    /// @notice Address to which rewards will be distributed
    address public rewardRecipient;

    /// @notice Mapping from vToken to deployed ERC4626 vault
    mapping(address => ERC4626Upgradeable) public vaults;

    /// @notice Mapping indicating whether a vault belongs to core pool
    mapping(address => bool) public isCoreVault;

    /// @notice Emitted when a new vault is created
    /// @param vToken The address of the vToken for which the vault was created
    /// @param vault The deployed ERC4626 vault address
    /// @param isCore Whether the vault is for a core pool
    event VaultCreated(address indexed vToken, address indexed vault, bool isCore);

    /// @notice Emitted when the reward recipient address is updated
    /// @param oldRecipient The previous reward recipient address
    /// @param newRecipient The new reward recipient address
    event RewardRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    /// @notice Thrown when a vault already exists for the given vToken
    error VaultAlreadyExists();

    /// @notice Thrown when the vToken provided is not valid (either unlisted or not part of the pool registry)
    error InvalidVToken();

    /// @notice Constructor (disable initializer for upgradeable contract)
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the factory contract
    /// @param accessControlManager Access control manager address
    /// @param isolatedImplementation Implementation address for isolated vaults
    /// @param coreImplementation Implementation address for core vaults
    /// @param poolRegistry_ Pool registry address
    /// @param coreComptroller_ Core pool comptroller address
    /// @param rewardRecipient_ Initial reward recipient address
    function initialize(
        address accessControlManager,
        address isolatedImplementation,
        address coreImplementation,
        address poolRegistry_,
        address coreComptroller_,
        address rewardRecipient_,
        uint256 loopsLimitNumber
    ) external initializer {
        ensureNonzeroAddress(isolatedImplementation);
        ensureNonzeroAddress(coreImplementation);
        ensureNonzeroAddress(poolRegistry_);
        ensureNonzeroAddress(coreComptroller_);
        ensureNonzeroAddress(rewardRecipient_);

        __AccessControlled_init(accessControlManager);
        _setMaxLoopsLimit(loopsLimitNumber);

        isolatedBeacon = new UpgradeableBeacon(isolatedImplementation);
        coreBeacon = new UpgradeableBeacon(coreImplementation);

        poolRegistry = PoolRegistryInterface(poolRegistry_);
        coreComptroller = ComptrollerInterface(coreComptroller_);
        rewardRecipient = rewardRecipient_;

        isolatedBeacon.transferOwnership(owner());
        coreBeacon.transferOwnership(owner());
    }

    /// @notice Sets a new reward recipient address
    /// @param newRecipient The address of the new reward recipient
    /// @custom:access Controlled by ACM
    /// @custom:error ZeroAddressNotAllowed is thrown when the new recipient address is zero
    /// @custom:event RewardRecipientUpdated is emitted when the reward recipient address is updated
    function setRewardRecipient(address newRecipient) external {
        _checkAccessAllowed("setRewardRecipient(address)");
        ensureNonzeroAddress(newRecipient);

        emit RewardRecipientUpdated(rewardRecipient, newRecipient);
        rewardRecipient = newRecipient;
    }

    /// @notice Sets the max loops limit to protect from DoS due to unbounded iterations
    /// @param loopsLimit New maximum loop count
    /// @custom:event Emits MaxLoopsLimitUpdated event on success
    /// @custom:access Controlled by ACM
    function setMaxLoopsLimit(uint256 loopsLimit) external {
        _checkAccessAllowed("setMaxLoopsLimit(uint256)");
        _setMaxLoopsLimit(loopsLimit);
    }

    /// @notice Creates an ERC4626 vault for the given vToken
    /// @param vToken Address of the vToken
    /// @param isCore Indicates if the vToken is part of the core pool
    /// @return vault The deployed ERC4626 vault
    /// @custom:error VaultAlreadyExists if a vault already exists for the vToken
    /// @custom:error InvalidVToken if the vToken is invalid or unlisted
    /// @custom:event Emits VaultCreated event on successful deployment
    function createERC4626(address vToken, bool isCore) external returns (ERC4626Upgradeable vault) {
        if (address(vaults[vToken]) != address(0)) revert VaultAlreadyExists();

        if (isCore) {
            (bool listed, ) = coreComptroller.markets(vToken);
            if (!listed) revert InvalidVToken();
            vault = _deployCoreVault(vToken);
        } else {
            address underlying = IsolatedVTokenInterface(vToken).underlying();
            address comptroller = address(IsolatedVTokenInterface(vToken).comptroller());
            if (vToken != poolRegistry.getVTokenForAsset(comptroller, underlying)) {
                revert InvalidVToken();
            }

            vault = _deployIsolatedVault(vToken);
        }

        vaults[vToken] = vault;
        isCoreVault[vToken] = isCore;
        emit VaultCreated(vToken, address(vault), isCore);
    }

    /// @notice Computes the deterministic vault address for a given vToken
    /// @param vToken Address of the vToken
    /// @param isCore Indicates if the vault is for core pool
    /// @return The computed vault address
    function computeVaultAddress(address vToken, bool isCore) public view returns (address) {
        bytes32 salt = isCore ? CORE_SALT : ISOLATED_SALT;
        address beacon = isCore ? address(coreBeacon) : address(isolatedBeacon);
        bytes memory initData = isCore
            ? abi.encodeWithSelector(VenusERC4626Core.initialize.selector, vToken)
            : abi.encodeWithSelector(VenusERC4626Isolated.initialize.selector, vToken);

        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt,
                                keccak256(
                                    abi.encodePacked(type(BeaconProxy).creationCode, abi.encode(beacon, initData))
                                )
                            )
                        )
                    )
                )
            );
    }

    /// @dev Deploys a new isolated pool vault
    /// @param vToken Address of the isolated pool vToken
    /// @return The deployed vault as ERC4626Upgradeable
    function _deployIsolatedVault(address vToken) private returns (ERC4626Upgradeable) {
        VenusERC4626Isolated vault = VenusERC4626Isolated(
            address(
                new BeaconProxy{ salt: ISOLATED_SALT }(
                    address(isolatedBeacon),
                    abi.encodeWithSelector(VenusERC4626Isolated.initialize.selector, vToken)
                )
            )
        );
        vault.initialize2(address(_accessControlManager), rewardRecipient, 100, owner());
        return ERC4626Upgradeable(address(vault));
    }

    /// @dev Deploys a new core pool vault
    /// @param vToken Address of the core pool vToken
    /// @return The deployed vault as ERC4626Upgradeable
    function _deployCoreVault(address vToken) private returns (ERC4626Upgradeable) {
        VenusERC4626Core vault = VenusERC4626Core(
            address(
                new BeaconProxy{ salt: CORE_SALT }(
                    address(coreBeacon),
                    abi.encodeWithSelector(VenusERC4626Core.initialize.selector, vToken)
                )
            )
        );

        vault.initialize2(address(_accessControlManager), rewardRecipient, owner());
        return ERC4626Upgradeable(address(vault));
    }
}
