import "dotenv/config";
import { ethers } from "ethers";
import { CreditManager } from "./CreditManager";

const CREDIT_MANAGER = "0x6dc0EB1980fa6b3fa89F5b29937b9baab5865B3E";

async function main() {
  const rpc = process.env.RPC_URL;
  const provider = new ethers.providers.JsonRpcProvider(rpc);

  const creditManager = new CreditManager(CREDIT_MANAGER);
  await creditManager.loadOwners(provider);

  console.log("Credit accounts:", creditManager.creditAccounts);

  console.log(
    creditManager.getOwner(
      "0xD49429C8802A3627640B6D06fB9d7C4647bD9e5e",
      19279263
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .then(() => process.exit(0));
