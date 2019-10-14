require("dotenv").config();
const chalk = require("chalk");
const { note, JoinSplitProof } = require("aztec.js");
const { ethOptions, contractAddresses, getAccount, erc20 } = require("./helper");

const { RINKEBY_MNEMONIC_BOB, RINKEBY_MNEMONIC_ALICE } = process.env;
const splitValues = [20, 80];

let depositNotes = [];
let transferNotes = [];
let bob = null;
let alice = null;

async function initAccounts() {
  console.log(chalk.green("Initing accounts"));

  bob = await getAccount(RINKEBY_MNEMONIC_BOB);
  alice = await getAccount(RINKEBY_MNEMONIC_ALICE);

  console.log(`- bob's address: ${bob.address}`);
  console.log(`- alice's address: ${alice.address}`);
}

async function mint() {
  const mintValue = 200;
  console.log(chalk.green(`Minting ${mintValue} to Bob`));
  const tx = await bob.signers.erc20.mint(bob.address, mintValue);
  await tx.wait();
}

async function deposit() {
  const depositValue = 100;
  console.log(chalk.green(`Deposit ${depositValue} from Bob's public erc20 to a aztec note`));

  console.log(`- executing bob.signers.erc20.approve()`);
  await (await bob.signers.erc20.approve(contractAddresses.ace, depositValue)).wait();

  const depositNote = await note.create(bob.publicKey, depositValue);
  depositNotes = [depositNote];
  const proof = new JoinSplitProof([], depositNotes, bob.address, depositValue * -1, bob.address);
  const data = proof.encodeABI(contractAddresses.zkAsset);
  const signatures = proof.constructSignatures(contractAddresses.zkAsset, []);

  const prevBalance = await erc20.balanceOf(bob.address);
  console.log(`- prevBalance: ${prevBalance.toString()}`);

  console.log(`- executing ace.publicApprove(ZK_ASSET_ADDRESS, ${proof.hash}, ${depositValue})`);
  await (await bob.signers.ace.publicApprove(
    contractAddresses.zkAsset,
    proof.hash,
    depositValue
  )).wait();

  console.log(`- executing zkAssetSigner.confidentialTransfer()`);
  await (await bob.signers.zkAsset.confidentialTransfer(data, signatures, ethOptions)).wait();

  const currBalance = await erc20.balanceOf(bob.address);
  console.log(`- currBalance: ${currBalance.toString()}`);
}

async function transferFromBobToAlice() {
  const msg =
    `Split note to note A with ${splitValues[0]} value for bob & ` +
    `note B with ${splitValues[1]} value for alice`;
  console.log(chalk.green(msg));

  const noteA = await note.create(bob.publicKey, splitValues[0]);
  const noteB = await note.create(alice.publicKey, splitValues[1]);
  transferNotes = [noteA, noteB];
  const transferProof = new JoinSplitProof(
    [...depositNotes],
    [noteA, noteB],
    bob.address,
    0,
    bob.address
  );
  // console.log(bob.wallet.privateKey, bob.aztecAccount.privateKey);
  const transferSignatures = transferProof.constructSignatures(contractAddresses.zkAsset, [bob.aztecAccount]);
  const transferData = transferProof.encodeABI(contractAddresses.zkAsset);

  console.log("- executing transfer: zkAssetSigner.confidentialTransfer()");

  await (await bob.signers.zkAsset.confidentialTransfer(
    transferData,
    transferSignatures,
    ethOptions
  )).wait();
}

async function withdraw() {
  console.log(chalk.green("Executing withdraw"));
  const withdrawValue = 10;
  const [, noteB] = transferNotes;
  const noteC = await note.create(alice.publicKey, splitValues[1] - withdrawValue);
  const withdrawProof = new JoinSplitProof(
    [noteB],
    [noteC],
    alice.address,
    withdrawValue,
    alice.address
  );
  const withdrawSignatures = withdrawProof.constructSignatures(contractAddresses.zkAsset, [
    alice.aztecAccount
  ]);
  const withdrawData = withdrawProof.encodeABI(contractAddresses.zkAsset);

  console.log("- executing withdraw: zkAssetSigner.confidentialTransfer()");
  await (await alice.signers.zkAsset.confidentialTransfer(
    withdrawData,
    withdrawSignatures,
    ethOptions
  )).wait();
}

(async function start() {
  await initAccounts();
  await mint();
  await deposit();
  await transferFromBobToAlice();
  await withdraw();
})();
