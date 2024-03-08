import {
  IAddressProviderV3__factory,
  IDataCompressorV3,
  IDataCompressorV3__factory,
} from "@gearbox-protocol/sdk";
import { Address } from "@gearbox-protocol/sdk-gov";
import { CreditManagerDataStructOutput } from "@gearbox-protocol/sdk/lib/types/IDataCompressorV3";
import { providers } from "ethers";
import { formatBytes32String } from "ethers/lib/utils";

export class DataCompressor {
  #contract: IDataCompressorV3;

  public static async attach(
    addressProvider: Address,
    provider: providers.Provider
  ) {
    const dc = await IAddressProviderV3__factory.connect(
      addressProvider,
      provider
    ).getAddressOrRevert(formatBytes32String("DATA_COMPRESSOR"), 3_00);

    return new DataCompressor(dc, provider);
  }

  constructor(address: string, provider: providers.Provider) {
    this.#contract = IDataCompressorV3__factory.connect(address, provider);
  }

  public async getCreditManagerData(): Promise<
    Array<CreditManagerDataStructOutput>
  > {
    const result = await this.#contract.callStatic.getCreditManagersV3List();
    console.log(`DataCompressor: loaded ${result.length} credit managers`);
    return result;
  }
}
