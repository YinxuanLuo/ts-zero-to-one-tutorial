// ============================================================
// 07-lib.ts —— 第 07 章的"被导入方"
// 它专门用来演示：值导出、类型导出、以及 import type 的意义。
// 运行方式（在 examples 目录下）：
//   node 07-类与模块.ts
// ============================================================

// ---------- 1. 普通的值导出（运行时真实存在的东西）----------

export const VERSION = '1.0.0';

/** 一个最简的加法，用来演示"值"和"类型"的区别 */
export function add(a: number, b: number): number {
  return a + b;
}

/** 运行时的真私有字段演示：这个类只在 lib 里定义，被主文件导入 */
export class Counter {
  #count = 0; // JS 原生私有字段，运行时真的拦得住

  increment(): number {
    this.#count += 1;
    return this.#count;
  }

  get value(): number {
    return this.#count;
  }
}

// ---------- 2. 纯类型导出（编译后一个字节都不剩）----------

/** Currency 只存在于类型世界 */
export type Currency = 'CNY' | 'USD' | 'JPY';

/** Product 只存在于类型世界 */
export interface Product {
  readonly id: string;
  name: string;
  price: number;
  currency: Currency;
}

/** 格式化金额：这是值导出，要留在运行时 */
export function formatPrice(num: number, currency: Currency): string {
  const symbol = { CNY: '¥', USD: '$', JPY: '¥' }[currency];
  return `${symbol}${num.toFixed(2)}`;
}

// ---------- 3. 一个"只为类型服务"的导出，用来说明 treeshaking ----------

/**
 * describeProduct 的类型部分（Product）会在运行时被完全擦掉，
 * 只有 formatPrice 这个函数会留下。这就是 import type 的价值。
 */
export type ProductSummary = Pick<Product, 'id' | 'name'>;

// ---------- 4. 注意：默认导出也可以，本教程统一用命名导出 ----------
// export default add;  ← 不推荐，重命名随意、IDE 补全差、不利于摇树
