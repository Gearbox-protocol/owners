import { Address } from "@gearbox-protocol/sdk";

export interface Beneficiaries {
  holder: Address;
  creditAccount: Address;
  from: number;
  to: number;
  balance: number;
  balanceBN: bigint;
}
