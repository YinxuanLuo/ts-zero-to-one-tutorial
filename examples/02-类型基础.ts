/**
 * 第 02 章配套代码：类型基础与类型推断
 *
 * 运行：node 02-类型基础.ts
 * 检查：npx tsc --noEmit
 *
 * 这个文件里所有代码都是"正确写法"。
 * 想看报错长什么样，就把对应的注释解开——编译器会告诉你答案。
 */

console.log('========== 2.2 七个原始类型 ==========');

const s: string = '你好';
const n: number = 42;
const b: boolean = true;
const big: bigint = 100n;
const sym: symbol = Symbol('id');
const u: undefined = undefined;
const nul: null = null;

console.log({ s, n, b, big: big.toString(), sym: sym.toString(), u, nul });

// 注意：number 同时表示整数和小数，TS 区分不了
const intLike: number = 1;
const floatLike: number = 1.5;
const notANumber: number = NaN;
console.log('number 什么都装:', { intLike, floatLike, notANumber });

console.log('\n========== 2.3 数组与元组 ==========');

const names: string[] = ['Tom', 'Jerry'];
const scores: Array<number> = [90, 85]; // 和上一行完全等价
console.log('数组:', names, scores);

// 混合数组会被推断成联合类型数组
const mixed = [1, 'a', true];
//    ^? (string | number | boolean)[]
console.log('混合数组:', mixed);

// 只读数组：常见于函数参数，表示"我不会改你的数据"
function sum(nums: readonly number[]): number {
  // nums.push(1);  // ❌ TS2339: Property 'push' does not exist on type 'readonly number[]'.
  return nums.reduce((acc, cur) => acc + cur, 0);
}
console.log('只读数组求和:', sum([1, 2, 3]));

// 元组：每个位置的类型都被记住了
const pair: [string, number] = ['Tom', 18];
const [pairName, pairAge] = pair;
console.log('元组:', pairName, pairAge);

// 元组最常见的地方就是 Promise.all —— 返回值位置和类型一一对应
async function demoPromiseAll(): Promise<void> {
  const [userName, userAge] = await Promise.all([
    Promise.resolve('Tom'),
    Promise.resolve(18),
  ]);
  console.log('Promise.all 元组:', userName, userAge);
}
void demoPromiseAll();

console.log('\n========== 2.4 对象类型 ==========');

type Config = {
  readonly apiUrl: string;
  timeout?: number;
};

const cfg: Config = { apiUrl: 'https://example.com' };
// cfg.apiUrl = 'x';  // ❌ TS2540: Cannot assign to 'apiUrl' because it is a read-only property.

// 可选属性是 number | undefined，用之前必须处理
const timeout = cfg.timeout ?? 3000;
console.log('配置:', cfg.apiUrl, '超时:', timeout);

console.log('\n========== 2.5 特殊类型：unknown / never / void ==========');

// unknown：把不确定性逼到明面上，用 if 消掉
function describe(input: unknown): string {
  if (typeof input === 'string') {
    return `字符串: ${input.toUpperCase()}`;
  }
  if (typeof input === 'number') {
    return `数字: ${input.toFixed(2)}`;
  }
  if (Array.isArray(input)) {
    return `数组，长度 ${input.length}`;
  }
  if (input === null) {
    return 'null';
  }
  return `其他类型: ${typeof input}`;
}

console.log(describe('hello'));
console.log(describe(3.14159));
console.log(describe([1, 2, 3]));
console.log(describe(null));
console.log(describe({ a: 1 }));

// never：永不返回的函数
function fail(msg: string): never {
  throw new Error(msg);
}

// never 最实用的场景：穷尽检查
type Status = 'loading' | 'success' | 'error';

function assertNever(x: never): never {
  throw new Error(`未处理的状态: ${String(x)}`);
}

function renderStatus(status: Status): string {
  switch (status) {
    case 'loading':
      return '加载中';
    case 'success':
      return '成功';
    case 'error':
      return '失败';
    default:
      // 走到这里，status 的类型已经收窄成 never —— 说明上面全处理完了
      return assertNever(status);
  }
}

console.log('穷尽检查:', renderStatus('loading'), renderStatus('success'), renderStatus('error'));

// 小实验：把 Status 改成 'loading' | 'success' | 'error' | 'cancelled'
// 你会发现 renderStatus 立刻编译报错，提醒你漏了分支。这就是 never 的价值。

// void：不关心返回值
const list = [1, 2, 3];
list.forEach((item) => {
  return item * 2; // 返回了也没关系，因为 forEach 的回调签名是 (v: number) => void
});

console.log('\n========== 2.6 类型推断 ==========');

// let 推断成宽类型，const 推断成字面量类型
let letNum = 1;
//  ^? number
const constNum = 1;
//    ^? 1
let letStr = 'hello';
//  ^? string
const constStr = 'hello';
//    ^? "hello"
console.log('推断结果:', typeof letNum, typeof constNum, typeof letStr, typeof constStr);

// 返回值推断：不用写
function add(a: number, b: number) {
  return a + b; // 推断为 number
}
console.log('返回值推断:', add(1, 2));

// 上下文推断：n 的类型是 TS 从 map 的签名倒推给你的
const doubled = [1, 2, 3].map((item) => item * 2);
console.log('上下文推断:', doubled);

// 空数组必须显式标注，否则是 any[]
const emptyOk: string[] = [];
// const emptyBad = [];   // any[]，塞什么进去都不报错

console.log('\n========== 2.7 写类型的品味 ==========');

// ❌ 坏品味：注解和值重复，注解还会过期
const badTaste: number = 1;

// ✅ 好品味：让 TS 推断
const goodTaste = 1;

// ❌ 坏品味：一行塞一个巨大类型，读的人很痛苦
function badSignature(cb: (e: Error | null, data: Record<string, string[] | number>) => void): void {
  cb(null, {});
}

// ✅ 好品味：起个名字，代码立刻能读
type Handler = (e: Error | null, data: Record<string, string[] | number>) => void;
function goodSignature(cb: Handler): void {
  cb(null, {});
}

console.log('品味对比跑通了:', badTaste, goodTaste);
badSignature(() => {});
goodSignature(() => {});

console.log('\n========== 2.8 type 别名 ==========');

type ID = string | number;
type Point = { x: number; y: number };
type Formatter = (value: number) => string;

const userId: ID = 'abc';
const userId2: ID = 123;
const origin: Point = { x: 0, y: 0 };
const toFixed2: Formatter = (value) => value.toFixed(2);

console.log('type 别名:', userId, userId2, origin, toFixed2(1.23456));

console.log('\n全部示例运行完毕。');
