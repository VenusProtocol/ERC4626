// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ERC4626Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import { AccessControlledV8 } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

import { IComptroller } from "./Interfaces/IComptroller.sol";
import { VenusERC4626Core } from "./VenusERC4626Core.sol";
import { VenusERC4626Isolated } from "./VenusERC4626Isolated.sol";

import { PoolRegistryInterface } from "@venusprotocol/isolated-pools/contracts/Pool/PoolRegistryInterface.sol";
import { MaxLoopsLimitHelper } from "@venusprotocol/isolated-pools/contracts/MaxLoopsLimitHelper.sol";
import { VTokenInterface } from "./Interfaces/VTokenInterface.sol";

/// @title ERC4626Factory
/// @notice Factory contract for deploying ERC4626 vaults (core and isolated) with beacon proxies.
contract VenusERC4626Factory is AccessControlledV8, MaxLoopsLimitHelper {
    /// @notice Salt used to deterministically deploy isolated pool vaults
    /// @dev Previously named `salt`
    bytes32 public constant ISOLATED_SALT = keccak256("Venus-ERC4626 Vault");

    /// @notice Beacon for isolated vaults
    /// @dev Previously named `beacon`
    UpgradeableBeacon public isolatedBeacon;

    /// @notice PoolRegistry contract to validate isolated pool vTokens
    PoolRegistryInterface public poolRegistry;

    /// @notice Address to which rewards will be distributed
    address public rewardRecipient;

    /// @notice Mapping from vToken to deployed ERC4626 vaults
    mapping(address vToken => ERC4626Upgradeable vault) public createdVaults;

    /// @notice Salt used to deterministically deploy core pool vaults
    bytes32 public constant CORE_SALT = keccak256("Venus-Core-ERC4626");

    /// @notice Beacon for core vaults
    UpgradeableBeacon public coreBeacon;

    /// @notice Comptroller for core pool validation
    IComptroller public coreComptroller;

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

    /// @notice Thrown when the provided vToken is not registered in PoolRegistry
    error VenusERC4626Factory__InvalidVToken();

    /// @notice Thrown when a VenusERC4626 already exists for the provided vToken
    error VenusERC4626Factory__ERC4626AlreadyExists();

    /// @notice Constructor
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
        rewardRecipient = rewardRecipient_;

        if (coreComptroller_ != address(0)) {
            coreComptroller = IComptroller(coreComptroller_);
        } else {
            coreComptroller = IComptroller(address(0));
        }

        // The owner of the beacon will initially be the owner of the factory
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
    /// @return vault The deployed ERC4626 vault
    /// @custom:error VaultAlreadyExists if a vault already exists for the vToken
    /// @custom:error InvalidVToken if the vToken is invalid or unlisted
    /// @custom:event Emits VaultCreated event on successful deployment
    function createERC4626(address vToken) external returns (ERC4626Upgradeable vault) {
        if (address(createdVaults[vToken]) != address(0)) revert VenusERC4626Factory__ERC4626AlreadyExists();

        bool isCore = _isCoreVToken(vToken);
        isCoreVault[vToken] = isCore;

        if (isCore) {
            vault = _deployCoreVault(vToken);
        } else {
            address underlying = VTokenInterface(vToken).underlying();
            address comptroller = address(VTokenInterface(vToken).comptroller());
            if (vToken != poolRegistry.getVTokenForAsset(comptroller, underlying)) {
                revert VenusERC4626Factory__InvalidVToken();
            }

            vault = _deployIsolatedVault(vToken);
        }

        createdVaults[vToken] = vault;
        emit VaultCreated(vToken, address(vault), isCore);
    }

    /// @notice Computes the deterministic vault address for a given vToken
    /// @param vToken Address of the vToken
    /// @return The computed vault address
    function computeVaultAddress(address vToken) public view returns (address) {
        bool isCore = _isCoreVToken(vToken);

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

    /// @notice Checks if the provided vToken is a core pool vToken
    /// @dev This function uses the coreComptroller to verify if the vToken is listed.
    /// @param vToken Address of the vToken to check
    /// @return True if the vToken is a core pool vToken, false otherwise
    function _isCoreVToken(address vToken) internal view returns (bool) {
        if (address(coreComptroller) == address(0)) {
            return false;
        }

        try coreComptroller.markets(vToken) returns (bool listed, uint256) {
            return listed;
        } catch {
            return false;
        }
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
        vault.initialize2(address(_accessControlManager), rewardRecipient, owner());
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
