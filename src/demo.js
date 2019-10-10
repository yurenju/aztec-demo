require("dotenv").config();
const ethers = require("ethers");
const { note, JoinSplitProof } = require("aztec.js");

const { ROPSTEN_MNEMONIC } = process.env;

const abis = {
  erc20: [
    "function balanceOf(address owner) view returns (uint)",
    "function transfer(address to, uint amount)",
    "function mint(address addr, uint amount)",
    "function approve(address spender, uint256 value) external returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
  ],
  ace: [
    "function publicApprove(address _registryOwner, bytes32 _proofHash, uint256 _value)"
  ],
  zkAsset: [
    "function confidentialTransfer(bytes _proofData, bytes _signatures) public"
  ]
};

const rinkeby = {
  name: "rinkeby",
  id: 4
};

const provider = ethers.getDefaultProvider(rinkeby.name);
const wallet = ethers.Wallet.fromMnemonic(ROPSTEN_MNEMONIC).connect(provider);

const ERC20Mintable = "0xaa161FA77204c5fb0199026051ec781E64AD1217";
const ACE = "0xA3D1E4e451AB20EA33Dc0790b78fb666d66A650D";
const ZkAsset = "0x89Fd81Eb57C54683B7d6bd518049f067046115C5";

const erc20Mntable = new ethers.Contract(ERC20Mintable, abis.erc20, provider);
const ace = new ethers.Contract(ACE, abis.ace, provider);
const zkAsset = new ethers.Contract(ZkAsset, abis.zkAsset, provider);

(async function start() {
  const erc20signer = erc20Mntable.connect(wallet);
  const zkAssetSigner = zkAsset.connect(wallet);
  const aceSigner = ace.connect(wallet);
  const accountAddr = await wallet.getAddress();

  console.log(`account address: ${accountAddr}`);
  const tx = await erc20signer.mint(accountAddr, 10000);
  await tx.wait();

  const publicKey = wallet.signingKey.publicKey;
  const value = 10;

  console.log(`executing erc20signer.approve(ACE_ADDRESS, ${value}})`);
  await (await erc20signer.approve(ACE, value)).wait();

  const settlementNote = await note.create(publicKey, value);
  const proof = new JoinSplitProof(
    [],
    [settlementNote],
    accountAddr,
    value * -1,
    accountAddr
  );
  const data = proof.encodeABI(ZkAsset);
  const signatures = proof.constructSignatures(ZkAsset, []);

  const prevBalance = await erc20Mntable.balanceOf(accountAddr);
  console.log(`prevBalance: ${prevBalance.toString()}`);

  console.log(
    `executing ace.publicApprove(ZK_ASSET_ADDRESS, ${proof.hash}, ${value})`
  );
  await (await aceSigner.publicApprove(ZkAsset, proof.hash, value)).wait();

  console.log(
    `executing zkAssetSigner.confidentialTransfer(${data}, ${signatures})`
  );
  let overrides = {
    gasLimit: 750000
  };
  await (await zkAssetSigner.confidentialTransfer(
    data,
    signatures,
    overrides
  )).wait();
})();
