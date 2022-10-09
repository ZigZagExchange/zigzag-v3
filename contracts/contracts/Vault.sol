import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Vault is ERC20 {
  event Swap(address taker, address sellToken, address buyToken, uint sellAmount, uint buyAmount);
  event CancelOrder(bytes32 orderhash);
  event Deposit(address user, uint amount);
  event Withdraw(address user, uint amount);
  
  address public constant ETH_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000000; 

  // The manager of a vault is allowed to sign orders that a vault can execute
  address manager;

  // Vaults need to track all fills so cancellations and size limits can be respected
  mapping(bytes32 => uint) fills;

  // The format for the EIP-712 vault orders 
  struct Order {
    address vault; 
    address sellToken; 
    address buyToken; 
    uint256 sellAmount; 
    uint256 buyAmount; 
    uint256 expirationTimeSeconds; 
  }

  // EIP-712 Domain Hash
  bytes32 constant internal eip712DomainHash = 0x0b77881b74293169ab609951890da059fe0dc57a910515b0e9fc90c65800a39f;
  /*
  keccak256(
      abi.encode(
          keccak256(
              "EIP712Domain(string name,string version,uint256 chainId)"
          ),
          keccak256(bytes("ZigZag Vault")),
          keccak256(bytes("1")),
          uint256(42161)
      )
  ); 
  */

  bytes32 constant internal _EIP712_ORDER_SCHEMA_HASH = 0x7c1c5ef5f9d688960eba9e2ee0515a90f03376e79d5e0fc5dfd7de2e8cc0785b;
  //keccak256("Order(address vault,address sellToken,address buyToken,uint256 sellAmount,uint256 buyAmount,uint256 expirationTimeSeconds)")

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

  /////////////////////////////////////////////////////////////////////////
  // SWAP
  // fillAmount is in the sellToken of the order specifying how much to fill
  // fillAvailable is for transactions where amount exceeds available size. you can choose to fill what's available
  // This same function is re-used for LP deposits and withdraws
  // The manager can use mintLPToken and burnLPToken to set LP limits 
  // The LP token shares the same address as the vault and can be swapped like any other token

  function swap(Order memory order, bytes memory signature, uint fillAmount, bool fillAvailable) public payable {
    // validate signature
    bytes32 orderhash = calculateOrderHash(order);
    require(isValidSignature(orderhash, signature), "order signature is invalid");

    // adjust size if the user wants to fill whatever is available
    uint availableSize = order.sellAmount - fills[orderhash];
    if (fillAvailable && fillAmount > availableSize) {
      fillAmount = availableSize;
    } 
    require(fillAmount <= availableSize, "fill amount exceeds available size");

    // send out the sell token
    if (order.sellToken == ETH_TOKEN_ADDRESS) {
      payable(msg.sender).transfer(fillAmount);
    }
    else {
      IERC20(order.sellToken).transfer(msg.sender, fillAmount);
    }

    // transfer in the buy token
    uint buyFillAmount = order.buyAmount * fillAmount / order.sellAmount;
    if (order.buyToken == ETH_TOKEN_ADDRESS) {
      require(msg.value == buyFillAmount, "wrong ETH amount sent with order");
    }
    else {
      IERC20(order.buyToken).transferFrom(msg.sender, address(this), buyFillAmount);
    }

    emit Swap(msg.sender, order.sellToken, order.buyToken, fillAmount, buyFillAmount);
  }

  function cancelOrder(Order memory order) public {
    require(msg.sender == manager, "only manager can cancel orders");
    bytes32 orderhash = calculateOrderHash(order);
    fills[orderhash] = order.sellAmount;
  }

  function isValidSignature(bytes32 orderhash, bytes memory signature) public view returns (bool) {
    uint8 v;
    bytes32 r;
    bytes32 s;
    assembly {
        r := mload(add(signature, 32))
        s := mload(add(signature, 64))
        v := byte(0, mload(add(signature, 96)))
    }
    address recovered = ecrecover( orderhash, v, r, s);
    return (recovered == manager);
  }

  function calculateOrderHash(Order memory order) public pure returns (bytes32) {
      bytes32 orderhash = keccak256(
        abi.encode(
            _EIP712_ORDER_SCHEMA_HASH,
            order.vault,
            order.sellToken,
            order.buyToken,
            order.sellAmount,
            order.buyAmount,
            order.expirationTimeSeconds
        )
      );
       
      return keccak256(abi.encodePacked("\x19\x01",eip712DomainHash,orderhash));
  }
}
