import {
  ICreditConfiguratorV3__factory,
  ICreditFacadeV3__factory,
  ICreditManagerV3__factory,
} from "@gearbox-protocol/sdk";
import { Address } from "@gearbox-protocol/sdk-gov";
import {
  CloseCreditAccountEvent,
  OpenCreditAccountEvent,
} from "@gearbox-protocol/sdk/lib/types/ICreditFacadeV3.sol/ICreditFacadeV3";
import { providers } from "ethers";
import { Owner } from "./Owner";

export class CreditManager {
  creditManager: Address;
  #owners: Record<string, Array<Owner>> = {};

  constructor(creditManager: Address) {
    this.creditManager = creditManager;
  }

  getOwner(creditAccount: Address, block: number): Address {
    const owners = this.#owners[creditAccount];
    if (!owners) {
      throw new Error(
        `Credit account ${creditAccount} does not have any owners`
      );
    }

    const owner = owners.find((o) => {
      return o.since <= block && (o.till === undefined || o.till > block);
    });

    if (!owner) {
      throw new Error(
        `Credit account ${creditAccount} does not have an owner at block ${block}`
      );
    }

    return owner.owner;
  }

  get creditAccounts(): Array<Address> {
    return Object.keys(this.#owners);
  }

  async loadOwners(provider: providers.Provider, toBlock?: number) {
    const cm = ICreditManagerV3__factory.connect(this.creditManager, provider);
    // get all historical creditConfigurators for this cm
    const ccAddrs = (
      await cm.queryFilter(
        cm.filters.SetCreditConfigurator(),
        undefined,
        toBlock
      )
    ).map((e) => e.args.newConfigurator);

    // get all historical creditFacades for this cm
    const cfUpgraded = (
      await Promise.all(
        ccAddrs.map(async (ccAddr): Promise<string[]> => {
          const cc = ICreditConfiguratorV3__factory.connect(ccAddr, provider);
          const cfUpgradedEvents = await cc.queryFilter(
            cc.filters.SetCreditFacade(),
            undefined,
            toBlock
          );
          return cfUpgradedEvents.map((e) => e.args.creditFacade);
        })
      )
    ).flat();

    for (const creditFacade of cfUpgraded) {
      const cf = ICreditFacadeV3__factory.connect(creditFacade, provider);

      const topics = {
        OpenCreditAccount: cf.interface.getEventTopic("OpenCreditAccount"),
        CloseCreditAccount: cf.interface.getEventTopic("CloseCreditAccount"),
      };

      const logs = await cf.queryFilter(
        {
          address: cf.address,
          topics: [Object.values(topics)],
        },
        undefined,
        toBlock
      );

      logs.forEach((e) => {
        const event = cf.interface.parseLog(e);
        switch (e.topics[0]) {
          case topics.OpenCreditAccount: {
            const { creditAccount, onBehalfOf } = (
              event as unknown as OpenCreditAccountEvent
            ).args;

            this.#openCreditAccount(creditAccount, onBehalfOf, e.blockNumber);
            break;
          }
          case topics.CloseCreditAccount: {
            // We need { borrower} only so, we can use any event to get it from args
            const { creditAccount, borrower } = (
              event as unknown as CloseCreditAccountEvent
            ).args;

            this.#closeCreditAccount(creditAccount, borrower, e.blockNumber);
            break;
          }
        }
      });
    }
  }

  #openCreditAccount(
    creditAccount: Address,
    owner: string,
    since: number
  ): void {
    if (!this.#owners[creditAccount]) {
      this.#owners[creditAccount] = [];
    }

    this.#owners[creditAccount].push(new Owner(owner, since));
  }

  #closeCreditAccount(
    creditAccount: Address,
    owner: string,
    till: number
  ): void {
    const ownerAccounts = this.#owners[creditAccount];
    if (!ownerAccounts) {
      throw new Error(`Owner ${owner} does not have any credit accounts`);
    }

    const lastOwner = ownerAccounts[ownerAccounts.length - 1];

    if (lastOwner.owner !== owner) {
      throw new Error(
        `Owner ${owner} is not the last owner of credit account ${creditAccount}`
      );
    }
    lastOwner.till = till;
  }
}
