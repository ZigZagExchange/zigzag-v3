import "./Vault.sol";

contract VaultFactory {
  event VaultCreated(address vault, address manager, string LPTokenName, string LPTokenSymbol);
  
  function createVault(address manager, string memory LPTokenName, string memory LPTokenSymbol) public {
    Vault vault = new Vault(manager, LPTokenName, LPTokenSymbol);
    emit VaultCreated(address(vault), manager, LPTokenName, LPTokenSymbol);
  }
}
