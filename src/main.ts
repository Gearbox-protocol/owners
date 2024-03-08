import "dotenv/config";
import fs from "node:fs";
import { ethers } from "ethers";
import { CreditManager } from "./CreditManager";
import {
  Address,
  SupportedToken,
  tokenSymbolByAddress,
} from "@gearbox-protocol/sdk";
import { DataCompressor } from "./DataCompressor";
import { TokenTracker } from "./TokenTracker";
import { Beneficiaries } from "./types";
import { json_stringify } from "./bigint-serializer";

const token: SupportedToken = "weETH";
const ADDRESS_PROVIDER = "0x9ea7b04da02a5373317d745c1571c84aad03321d";

async function main() {
  const rpc = process.env.RPC_URL;
  const provider = new ethers.providers.JsonRpcProvider(rpc);

  console.log("Main: loading DataCompressor...");
  const dc = await DataCompressor.attach(ADDRESS_PROVIDER, provider);

  const creditManagersData = await dc.getCreditManagerData();

  const cmsHaveTokenAsCollateral = creditManagersData
    .filter((cm) =>
      cm.collateralTokens
        .map((t) => tokenSymbolByAddress[t.toLowerCase()])
        .includes(token)
    )
    .map((cm) => cm.addr);

  console.log(
    `Main: ${token} is used as collateral in ${cmsHaveTokenAsCollateral.length} credit managers`
  );

  const creditManagers: Record<Address, CreditManager> = {};

  const allCreditAccounts = new Set<Address>();

  for (const cm of cmsHaveTokenAsCollateral) {
    const creditManager = new CreditManager(cm);
    await creditManager.loadOwners(provider);

    creditManager.creditAccounts.forEach((ca) => {
      creditManagers[ca.toLowerCase()] = creditManager;
      allCreditAccounts.add(ca.toLowerCase());
    });
  }

  console.log(
    `Main: loaded ${allCreditAccounts.size} credit accounts from ${cmsHaveTokenAsCollateral.length} credit managers`
  );

  const tracker = new TokenTracker(token, provider);
  await tracker.loadHolders(Array.from(allCreditAccounts));

  const beneficiaries: Array<Beneficiaries> = tracker.holderRanges.map((hr) => {
    const creditManager = creditManagers[hr.holder.toLowerCase()];
    const owner = creditManager.getOwner(hr.holder, hr.to, hr.balance);
    return {
      holder: owner,
      creditAccount: hr.holder,
      from: hr.from,
      to: hr.to,
      balance:
        Number(hr.balance / BigInt(10 ** (tracker.decimals!! - 4))) / 10_000,
      balanceBN: hr.balance,
    };
  });

  fs.writeFileSync("beneficiaries.json", json_stringify(beneficiaries));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .then(() => process.exit(0));
