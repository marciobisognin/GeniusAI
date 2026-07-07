/**
 * PRNG determinístico (mulberry32). O estado é um inteiro de 32 bits,
 * serializável no World — assim a simulação é 100% reproduzível (replay).
 */
export class Rng {
  state: number;

  constructor(state: number) {
    this.state = state >>> 0;
  }

  /** Próximo float em [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}
