import "./Vault.sol";

contract VaultFactory {
  event VaultCreated(address vault, address manager);
  
  function createVault(address manager) public {
    Vault vault = new Vault(manager);
    emit VaultCreated(address(vault), manager);
  }
}
