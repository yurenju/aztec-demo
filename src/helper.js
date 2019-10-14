const ethers = require("ethers");
const secp256k1 = require("@aztec/secp256k1");

const networks = {
  rinkeby: {
    name: "rinkeby",
    id: 4
  }
};

const abis = {
  erc20: [
    "function balanceOf(address owner) view returns (uint)",
    "function transfer(address to, uint amount)",
    "function mint(address addr, uint amount)",
    "function approve(address spender, uint256 value) external returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
  ],
  ace: ["function publicApprove(address _registryOwner, bytes32 _proofHash, uint256 _value)"],
  zkAsset: ["function confidentialTransfer(bytes _proofData, bytes _signatures) public"]
};

const contractAddresses = {
  erc20: "0xaa161FA77204c5fb0199026051ec781E64AD1217",
  ace: "0xA3D1E4e451AB20EA33Dc0790b78fb666d66A650D",
  zkAsset: "0xae5fEB559F4486730333cabFaa407A9e10c0E874"
};

const ethersProvider = ethers.getDefaultProvider(networks.rinkeby.name);
const ace = new ethers.Contract(contractAddresses.ace, abis.ace, ethersProvider);
const zkAsset = new ethers.Contract(contractAddresses.zkAsset, abis.zkAsset, ethersProvider);
const erc20 = new ethers.Contract(contractAddresses.erc20, abis.erc20, ethersProvider);

const ethOptions = {
  gasLimit: 750000
};

async function getAccount(mnemonic) {
  const wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(ethersProvider);
  const address = await wallet.getAddress();
  return {
    address,
    wallet,
    publicKey: wallet.signingKey.publicKey,
    aztecAccount: secp256k1.accountFromPrivateKey(wallet.privateKey),
    signers: {
      erc20: erc20.connect(wallet),
      zkAsset: zkAsset.connect(wallet),
      ace: ace.connect(wallet)
    }
  };
}

module.exports = {
  ethOptions,
  contractAddresses,
  getAccount,
  erc20
};
