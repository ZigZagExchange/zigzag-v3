import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Vault is ERC20 {
  // The manager of a vault is allowed to sign orders that a vault can execute
  address manager;

  constructor(address _manager, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
    manager = _manager;
  }

  function updateManager(address newManager) public {
    require(msg.sender == manager, "only manager can update manager");
    manager = newManager;
  }

  /////////////////////////////////////////////////////////////////////
  // The manager can use mintLPToken and burnLPToken to set LP limits 
  // The LP tokens are then swapped for user funds

  function mintLPToken(uint amount) public {
    require(msg.sender == manager, "only manager can mint LP tokens");
    _mint(address(this), amount);
  }

  function burnLPToken(uint amount) public {
    require(msg.sender == manager, "only manager can burn LP tokens");
    _burn(address(this), amount);
  }

  ////////////////////////////////////////////////////
  // EIP-1271 Smart Contract Signatures
  // https://eips.ethereum.org/EIPS/eip-1271

  function isValidSignature(
    bytes32 _hash,
    bytes calldata _signature
  ) external override view returns (bytes4) {
    (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(_hash, _signature);
    if (error == ECDSA.RecoverError.NoError && recovered == manager) {
      return 0x1626ba7e;
    } else {
      return 0xffffffff;
    }
  }
}
