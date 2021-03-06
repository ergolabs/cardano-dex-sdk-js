import {CardanoNetwork} from "../../quickblue/cardanoNetwork"
import {decodeHex, encodeHex} from "../../utils/hex"
import {CardanoWasm} from "../../utils/rustLoader"
import {RawTx, TxCandidate} from "../entities/tx"
import {Prover} from "../wallet/prover"
import {TxAsm} from "../wallet/txAsm"

export interface TxCompletionPipeline {
  complete(txc: TxCandidate): Promise<RawTx>
}

export function mkTxCompletionPipeline(
  asm: TxAsm,
  prover: Prover,
  network: CardanoNetwork,
  R: CardanoWasm
): TxCompletionPipeline {
  return new DefaultTxCompletionPipeline(asm, prover, network, R)
}

class DefaultTxCompletionPipeline implements TxCompletionPipeline {
  constructor(
    public readonly asm: TxAsm,
    public readonly prover: Prover,
    public readonly network: CardanoNetwork,
    public readonly R: CardanoWasm
  ) {}

  async complete(txc: TxCandidate): Promise<RawTx> {
    const collectedData = txc.outputs.map(x => x.data)
    const unsignedTxRaw = this.asm.finalize(txc)
    const unsignedTx = this.R.Transaction.from_bytes(decodeHex(unsignedTxRaw))
    const witsRaw = await this.prover.sign(unsignedTxRaw)
    const wits = this.R.TransactionWitnessSet.from_bytes(decodeHex(witsRaw))
    const tx = this.R.Transaction.new(unsignedTx.body(), wits)
    await Promise.all(collectedData.map(x => (x ? this.network.reportDatum(x) : Promise.resolve())))
    return encodeHex(tx.to_bytes())
  }
}
