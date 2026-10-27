/** 可复现的伪随机数：每轮测试持久化 seed，外部评测脚本可用同一 seed 重算 Ground Truth。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private next01: () => number

  constructor(seed: number) {
    this.next01 = mulberry32(seed)
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next01() * (max - min + 1))
  }

  /** 金额，保留两位小数。 */
  amount(min: number, max: number): number {
    return Math.round((min + this.next01() * (max - min)) * 100) / 100
  }

  bool(probability = 0.5): boolean {
    return this.next01() < probability
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]
  }

  /** 不放回抽样。 */
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items.slice()).slice(0, count)
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i)
      ;[items[i], items[j]] = [items[j], items[i]]
    }
    return items
  }

  digits(count: number): string {
    let out = ''
    for (let i = 0; i < count; i += 1) out += this.int(0, 9)
    return out
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}
