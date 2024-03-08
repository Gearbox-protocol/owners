import {
  IERC20Metadata,
  IERC20Metadata__factory,
  NetworkType,
  SupportedToken,
  formatBN,
  tokenDataByNetwork,
} from "@gearbox-protocol/sdk";
import { Address } from "@gearbox-protocol/sdk-gov";
import { TransferEvent } from "@gearbox-protocol/sdk/lib/types/IConvexToken";
import { providers } from "ethers";

export interface TokenHolding {
  holder: Address;
  from: number;
  to: number;
  balance: bigint;
}

export class TokenTracker {
  token: SupportedToken;
  address: Address;
  provider: providers.Provider;

  decimals: number | undefined = undefined;

  holderRanges: Array<TokenHolding> = [];

  #contract: IERC20Metadata;

  constructor(
    token: SupportedToken,
    provider: providers.Provider,
    network: NetworkType = "Mainnet"
  ) {
    this.token = token;
    this.address = tokenDataByNetwork[network][token];
    this.provider = provider;
    this.#contract = IERC20Metadata__factory.connect(this.address, provider);
  }

  public async loadHolders(trackingTokens: Array<Address>, toBlock?: number) {
    const tempBalances: Record<Address, bigint> = {};
    const lastUpdate: Record<Address, number> = {};

    this.decimals = await this.#contract.decimals();

    console.log(`TokenTracker: ${this.token} has ${this.decimals} decimals`);
    console.log(`TokenTracker: loading transfer events`);

    toBlock = toBlock || (await this.provider.getBlockNumber());

    const events = await this.greedyQuery(0, toBlock);

    console.log(
      `TokenTracker: ${events.length} transfer events found, processing...`
    );

    for (const event of events) {
      const from = event.args.from.toLowerCase();
      const to = event.args.to.toLowerCase();
      const value = BigInt(event.args.value.toString());

      if (trackingTokens.includes(from)) {
        if (!tempBalances[from]) {
          const initialBalance = await this.#contract.balanceOf(from, {
            blockTag: event.blockNumber,
          });
          tempBalances[from] = BigInt(initialBalance.toString());
          console.log(
            `TokenTracker: initial balance for ${from} is ${formatBN(tempBalances[from], this.decimals)}`
          );

          console.log(
            `Holder will be skipped, because it doesnt track initial balance`
          );

          continue;
        }
        this.holderRanges.push({
          holder: from,
          from: lastUpdate[from],
          to: event.blockNumber,
          balance: tempBalances[from],
        });

        tempBalances[from] -= value;
        lastUpdate[from] = event.blockNumber;
      }

      if (trackingTokens.includes(to)) {
        if (lastUpdate[to] !== undefined && tempBalances[to] > 1n) {
          this.holderRanges.push({
            holder: to,
            from: lastUpdate[to],
            to: event.blockNumber,
            balance: tempBalances[to],
          });
        }
        tempBalances[to] = (tempBalances[to] || 0n) + value;
        lastUpdate[to] = event.blockNumber;
      }
    }

    // Adding current holders
    for (const [holder, balance] of Object.entries(tempBalances)) {
      if (balance > 1n) {
        this.holderRanges.push({
          holder: holder,
          from: lastUpdate[holder],
          to: toBlock,
          balance: balance,
        });
      }
    }
  }

  private async greedyQuery(
    fromBlock: number,
    toBlock: number
  ): Promise<Array<TransferEvent>> {
    console.log(
      `TokenTracker: trying to query Transfer events from ${fromBlock} to ${toBlock}`
    );
    try {
      return await this.#contract.queryFilter(
        this.#contract.filters.Transfer(),
        fromBlock,
        toBlock
      );
    } catch (e) {
      const left = await this.greedyQuery(
        fromBlock,
        Math.floor(fromBlock + (toBlock - fromBlock) / 2)
      );
      const right = await this.greedyQuery(
        Math.floor(fromBlock + (toBlock - fromBlock) / 2) + 1,
        toBlock
      );
      return [...left, ...right];
    }
  }
}
