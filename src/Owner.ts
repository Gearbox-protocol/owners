import { Address } from "@gearbox-protocol/sdk-gov";

export class Owner {
  owner: Address;
  since: number;
  till: number | undefined;

  constructor(owner: Address, since: number) {
    this.owner = owner;
    this.since = since;
  }

  get stillHolding(): boolean {
    return this.till === undefined;
  }
}
