/**
 * 03 — 函数类型与对象类型（配套可运行代码）
 *
 * 怎么跑：
 *   node 03-函数与对象.ts
 *   npx tsc --noEmit        （或 pnpm exec tsc --noEmit）
 *
 * 本文件的设计原则：
 *   1. 所有「报错演示」都写成注释（含真实错误码），所以整个文件能通过类型检查、也能直接运行。
 *   2. 每一段都有中文注释解释「为什么这么写」。
 *   3. 输出都带 [标签]，方便对照讲义。
 *
 * 注意：Node 的 strip-only 模式不支持 enum / namespace / 构造函数参数属性，
 *      所以本文件一律不用这三样（要用常量就用 `as const` 对象 + 联合类型）。
 */

import type { Stats } from 'node:fs'; // 只导入类型时必须写 import type（verbatimModuleSyntax）

// ============================================================
// 0. 辅助工具
// ============================================================

/** 让异步演示看起来像真的在请求网络 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 模拟后端：根据路径返回不同数据 */
async function fakeFetch(path: string): Promise<unknown> {
  await sleep(1);
  const table: Record<string, unknown> = {
    '/user/1': { id: 1, name: 'Ada', tags: ['admin', 'vip'] },
    '/health': { ok: true, uptime: 12.5 },
  };
  return table[path];
}

console.log('========== 第 03 章：函数类型与对象类型 ==========');
console.log('[环境] Node:', process.version);

// ============================================================
// 1. 函数类型的两种写法
// ============================================================
// 关键心智模型：
//   类型位置的 `=>` 读作「一个函数，参数是……，返回……」
//   它跟「值位置的箭头函数」是两码事，只是长得像。
//
// 对照下面三行，看出 `=>` 的三种身份：
//   type A = (n: number) => string;      // 类型位置：表示「函数类型」
//   interface B { (n: number): string }  // 类型位置：调用签名，也是「函数类型」
//   const c = (n: number) => String(n);  // 值位置：真的创建了一个函数

// 写法 1：类型别名（最常用，短、好读）
type Formatter = (value: number) => string;

const toYuan: Formatter = (value) => `¥${value.toFixed(2)}`;
//                                ^? value 自动推断为 number（上下文推断）

// 写法 2：对象类型里的「调用签名」，等价于写法 1
interface Formatter2 {
  (value: number): string;
}
const toDollar: Formatter2 = (value) => `$${value.toFixed(2)}`;

// 什么时候用哪种？
//   只是「一个函数」 -> type 别名
//   这个函数还要挂额外属性（比如 jQuery 的 $、带 cache 的 memoize） -> 调用签名 + 属性
interface MemoizedFn {
  (n: number): number;
  cache: Map<number, number>;
  calls: number;
}

const fib: MemoizedFn = Object.assign(
  (n: number): number => {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
  },
  { cache: new Map<number, number>(), calls: 0 },
);

console.log('\n[1] 两种函数类型写法');
console.log('[1] toYuan(12.5) =', toYuan(12.5));
console.log('[1] toDollar(12.5) =', toDollar(12.5));
console.log('[1] fib(10) =', fib(10), '| fib 现在是函数也是对象, 额外属性 fib.calls =', fib.calls);

// ============================================================
// 2. 参数：可选 / 默认值 / 剩余 / 解构
// ============================================================

// --- 2.1 可选参数 ?（必须放最后） ---
// 一个? 就等于「这个参数可以是 undefined，也可以不传」
function greet(name: string, title?: string): string {
  return title ? `${title} ${name}` : name;
}
// ❌ 你可能这么写（可选参数放前面）：
//     function bad(a?: number, b: string): void {}
// 真实报错：
//     error TS1016: A required parameter cannot follow an optional parameter.

// --- 2.2 默认参数：自动变成可选 ---
// 注意：有默认值的参数不用写 ?，而且它在类型上就是 number | undefined
function retry(times = 3, delay = 100): string {
  return `重试 ${times} 次，每次间隔 ${delay}ms`;
}

// --- 2.3 剩余参数 ...rest：必须放最后，类型是「数组」 ---
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
// 也可以带前缀参数
function logAll(level: 'info' | 'warn', ...msgs: string[]): string {
  return `[${level}] ${msgs.join(' | ')}`;
}

// --- 2.4 解构参数：类型写在「整个对象」上，不是写在每个属性上 ---
// ❌ 你可能这么写（把类型写进解构里）：
//     function connect({ host: string, port: number }) {}
// 那是 JS 的「重命名语法」，不是类型注解，TS 会当成重命名然后报 host 不存在。
type ConnectOpts = {
  host: string;
  port?: number;
  timeout?: number;
};

function connect({ host, port = 80 }: ConnectOpts): string {
  //                          ^ 默认值和解构可以一起用，port 自动是 number
  return `${host}:${port}`;
}

console.log('\n[2] 参数的各种形态');
console.log('[2] greet("Ada") =', greet('Ada'), '| greet("Ada","Dr.") =', greet('Ada', 'Dr.'));
console.log('[2] retry() =', retry(), '| retry(5) =', retry(5));
console.log('[2] sum(1,2,3,4) =', sum(1, 2, 3, 4));
console.log('[2] logAll("warn","磁盘满","内存高") =', logAll('warn', '磁盘满', '内存高'));
console.log('[2] connect({host:"db"}) =', connect({ host: 'db' }));

// ============================================================
// 3. 返回值类型：void / Promise<T> / async
// ============================================================

// --- 3.1 void：表示「我不关心你的返回值」 ---
function printBanner(text: string): void {
  console.log('[3]', text);
  // 这里写 return 123 会报错，void 的函数不该有返回值
}
printBanner('void 表示没有返回值（也不该有）');

// void 的「漏勺」特性：把有返回值的函数赋给返回 void 的类型是合法的
// 因为调用者已经声明「我不要这个返回值」，返回值被丢掉是安全的
type Notify = (msg: string) => void;
const notify: Notify = (msg) => msg.toUpperCase(); // 返回了 string 也不报错
notify('返回值被丢掉'); // 但调用处拿不到它（类型是 void）

// --- 3.2 异步函数：返回类型写 Promise<T> ---
async function loadUser(id: number): Promise<{ id: number; name: string }> {
  await sleep(1);
  return { id, name: 'Ada' }; // async 函数里 return 的是 T，外面拿到的是 Promise<T>
}
// ❌ 你可能这么写：
//     async function load(): number { return 1; }
// 真实报错：
//     error TS1064: The return type of an async function or method must be the global
//     Promise<T> type. Did you mean to write 'Promise<number>'?

// --- 3.3 返回 this 实现链式调用（流式 API 常用） ---
class QueryBuilder {
  #parts: string[] = []; // # 私有字段：运行时真实存在，和 TS 的 private 不同
  select(...cols: string[]): this {
    this.#parts.push(`SELECT ${cols.join(', ')}`);
    return this; // 返回 this，链式调用才接得下去
  }
  from(table: string): this {
    this.#parts.push(`FROM ${table}`);
    return this;
  }
  build(): string {
    return this.#parts.join(' ');
  }
}

console.log('\n[3] 返回值类型');
console.log('[3] notify 的静态类型是 void，拿不到返回值');
console.log('[3] await loadUser(1) =', JSON.stringify(await loadUser(1)));
console.log('[3] 链式调用 =', new QueryBuilder().select('id', 'name').from('users').build());

// ============================================================
// 4. 函数重载：多个声明 + 一个实现
// ============================================================
// 解决的问题：同一个函数，不同的参数组合 -> 不同的返回类型。
// 注意：重载签名只能出现在「函数声明」上，不能写成 const + 箭头函数。

// ❌ 你可能这么写（想要「传 true 返回 string，传 false 返回 number」）：
//     function pick(flag: boolean): string | number {
//       return flag ? 'yes' : 0;
//     }
// 问题：调用 const x = pick(true) 时，x 的类型是 string | number，
//      你还得自己再收窄一次，等于没帮上忙。

// ✅ 正确写法：先写「重载签名」（只有类型、没有函数体），最后写「实现签名」
function pick(flag: true): string;
function pick(flag: false): number;
function pick(flag: boolean): string | number {
  // 实现签名对调用者不可见，但要能兼容上面所有签名
  return flag ? 'yes' : 0;
}

// 第二个真实场景：给 fetch 结果按参数决定是否带 meta
function unwrap(data: { list: number[]; meta: object }): number[];
function unwrap(data: { list: number[] }): number[];
function unwrap(data: { list: number[]; meta?: object }): number[] {
  return data.list;
}

// 一个「不推荐但必须认识」的例子：先声明后实现，实现签名不兼容会报 TS2394
//     function parseIt(input: string): number;
//     function parseIt(input: number): string;
//     function parseIt(input: string): number { return 1; }
// 真实报错：
//     error TS2394: This overload signature is not compatible with its implementation signature.
// 原因：第一个签名承诺「传 number 进、拿 string 出」，但实现只接受 string。

console.log('\n[4] 函数重载');
const p1 = pick(true);
const p2 = pick(false);
console.log('[4] pick(true) 的静态类型是 string ->', p1.toUpperCase());
console.log('[4] pick(false) 的静态类型是 number ->', p2.toFixed(2));
console.log('[4] unwrap({list:[1,2]}) =', unwrap({ list: [1, 2] }).join(','));

// ============================================================
// 5. this 类型
// ============================================================
// this 参数是 TS 的「假参数」：它只用来描述 this 的类型，运行时会被完全擦掉，
// 调用时也不会计入参数个数。

interface Counter {
  count: number;
  add(n: number): number; // 方法简写形式
}

const realCounter: Counter = {
  count: 0,
  add(n) {
    this.count += n; // this 被推断成 Counter（因为对象有上下文类型 Counter）
    return this.count;
  },
};

// 独立函数里的 this 必须显式声明类型，否则 noImplicitThis 会报 TS2683
function standaloneAdd(this: Counter, n: number): number {
  return this.count + n;
}

// 用 .call 指定 this（strictBindCallApply 下会被严格检查）
// 注意这里是「属性访问 + 调用」，没有把方法摘出来，所以 this 还得是完整的 Counter
const addResult = realCounter.add.call(realCounter, 5);

// 把方法从对象上摘下来单独调用时会丢 this，这时必须用 .call 补回来：
const extracted = realCounter.add;
// extracted(1);  -> TS2684: The 'this' context of type 'void' is not assignable to
//                    method's 'this' of type 'Counter'.
const viaCall = extracted.call(realCounter, 1); // ✅ 显式补上 this

// 关于「箭头函数没有自己的 this」：这是 JS 的规则，跟 TS 无关。
// TS 对此的贡献是：它会在箭头函数里直接告诉你 this 的类型，
// 而不会像普通函数那样给你一个 any 或者报 TS2683。
const holder = {
  value: 42,
  arrow: () => {
    // 这里的 this 不是 holder！箭头函数捕获外层（这里是模块顶层）的 this。
    // 在 ESM 顶层 this 是 undefined，所以 TS 会把它标成 void。
    return typeof this;
  },
  normal(): string {
    return typeof this; // 这里的 this 是 holder
  },
};

console.log('\n[5] this 类型');
console.log('[5] standaloneAdd.call({count:100}, 5) =', addResult);
console.log('[5] extracted.call(realCounter, 1) =', viaCall, '（摘下来的方法必须显式绑 this）');
console.log('[5] realCounter.add(7) =', realCounter.add(7));
console.log('[5] holder.normal() 里的 this =', holder.normal(), '| holder.arrow() 里的 this =', holder.arrow());
// 注意 arrow 拿不到 holder.value —— 这就是「箭头函数没有自己的 this」

// ============================================================
// 6. 函数参数的变异性：回调参数写窄了会出事（面试高频）
// ============================================================
// 规则（strictFunctionTypes）：
//   函数类型的「参数」是逆变的 —— 你的要求只能比它更宽松，不能更严格。
//   人话：它承诺「什么动物我都能处理」，你却只接受「狗」，那不行。
//   函数类型的「返回值」是协变的 —— 你返回的东西只能更具体。

console.log('\n[6] 参数逆变');
console.log('[6] dogs 能当 animals 用（Dog 一定是 Animal），但反之不行');

type Animal = { name: string; age: number };
type Dog = { name: string; age: number; bark(): void };

const animals: Animal[] = [
  { name: 'Cat', age: 3 },
  { name: 'Bird', age: 1 },
];
const dogs: Dog[] = [{ name: 'Wang', age: 4, bark: () => console.log('汪') }];

// 这个函数承诺：任何 Animal 我都能处理
function eachAnimal(list: Animal[], cb: (a: Animal) => void): void {
  for (const a of list) cb(a);
}

// ❌ 你可能这么写（回调参数写窄了）：
//     eachAnimal(dogs, (d: Dog) => d.bark());
// 真实报错：
//     error TS2345: Argument of type '(d: Dog) => void' is not assignable to
//     parameter of type '(a: Animal) => void'.
//       Types of parameters 'd' and 'a' are incompatible.
//         Property 'bark' is missing in type 'Animal' but required in type 'Dog'.
// 为什么危险：eachAnimal 内部会把 animals 里任意一只（可能是 Cat）交给 cb，
//            而你的 cb 一上来就调 d.bark()，Cat 没有 bark，运行时崩。

// ✅ 正确写法：参数类型跟承诺保持一致，在函数体里自己收窄
eachAnimal(animals, (a) => {
  // a 的类型是 Animal，这里安全地使用公共字段
  console.log('[6] 遍历到', a.name);
});

// 反向是合法的（更宽松 -> 可以塞进更严格的位置）
function eachDog(list: Dog[], cb: (d: Dog) => void): void {
  for (const d of list) cb(d);
}
eachDog(dogs, (a: Animal) => console.log('[6] 只读 name 就行 ->', a.name));
//                    ^ 你把 Dog 当 Animal 用，是安全的：Dog 一定有 name

// 为什么数组方法看起来不报错？因为「方法参数」是双变的（bivariant）。
// 这是官方故意的权衡：Array<T> 是库里的方法签名，
// 若严格逆变，Dog[] 就不能赋给 Animal[]，日常代码会大面积报错。
//
// 用一个泛型包装类看清「方法 vs 函数属性」的差别：
type Box2<T> = {
  m(x: T): void; // 方法简写 -> 双变
  p: (x: T) => void; // 函数属性 -> 严格逆变
};
declare const dogBox: Box2<Dog>;
// ⚠️ 只要 Box2 里还有一个函数属性 p，下面这行就会因为 p 报错：
//     Type 'Box2<Dog>' is not assignable to type 'Box2<Animal>'.
//       Property 'bark' is missing in type 'Animal' but required in type 'Dog'.
//
// 但如果把 p 去掉，只留方法 m，下面这行就是合法的 —— 这就是双变：
type OnlyMethod<T> = {
  m(x: T): void;
};
const dogBox2: OnlyMethod<Dog> = {
  m: (d) => {
    console.log('[6] 双变演示：拿到了', d.name, '，准备喊一声');
    d.bark();
  },
};
const animalBox: OnlyMethod<Animal> = dogBox2; // ✅ 方法简写这条路能过，编译器放行了
// animalBox.m({ name: 'Cat', age: 3 });       // ⚠️ 编译也通过，但运行时会在 d.bark() 处崩
// ↑ 这就是「双变」的代价：编译器放你过去，代价由运行时承担。
// 官方的权衡是：Array / Map 这些库类型如果严格逆变，
// 你的大多数日常代码都会报错，得不偿失。所以只在「函数属性」上严格检查。

// ============================================================
// 7. 函数类型之间的兼容性：四条人话规则
// ============================================================

console.log('\n[7] 函数类型之间的兼容性');

// 1) 参数「少」的可以赋给「多」的：少要求一点没关系。
//    const f1: (a: number) => void = () => {};          ✅
//    const f2: () => void = (a: number) => {};          ❌ TS2322 Target signature provides too few arguments
// 2) 返回值必须兼容（协变）：
//    const g1: () => void = () => 123;                  ✅ 返回值被丢掉
//    const g2: () => number = () => {};                 ❌ Type 'void' is not assignable to type 'number'
// 3) 可选参数 / 联合类型：要求只能更宽，不能更窄。
//    const h1: (a: number, b: number) => void = (a: number) => {};  ✅
//    const h2: (a: number) => void = (a: number, b?: number) => {}; ❌ TS2322 Types of parameters 'b' and 'b' are incompatible
// 4) 泛型参数是个例外：target 签名里出现类型参数时，TS 不做严格逆变检查。
//    这就是为什么 mapStrict(dogs, (a: Animal) => a.name) 这种「写窄了」的代码
//    在泛型函数上不报错 —— 它是逆变检查的一个已知盲区，别依赖它。

type One = (a: number) => void;
type Two = (a: number, b: number) => void;

const zeroArgs = () => console.log('[7] 我只要 0 个参数，你随便传');
const oneArg = (a: number) => console.log('[7] 我只要 1 个参数 ->', a);
const asTwo: Two = zeroArgs; // 合法：参数少可以赋给参数多
const asTwo2: Two = oneArg; // 合法
asTwo(1, 2);
asTwo2(1, 2);

// 返回值协变的实际用途：回调里多返回点东西没关系
const callbacks: Array<() => void> = [() => 1, () => 'x', () => ({})];
for (const cb of callbacks) cb();

console.log('[7] 参数少的函数可以赋给参数多的函数：少要求一点没关系');

// ============================================================
// 8. 对象类型：interface 完整语法
// ============================================================

interface User {
  readonly id: number; // 只读：第一层不能被重新赋值
  name: string; // 必需
  age?: number; // 可选：类型是 number | undefined
  tags: readonly string[]; // 只读数组：不能 push
  greet(this: User): string; // 方法简写（推荐，参数是双变的）
  toJSON(): string;
}

const ada: User = {
  id: 1,
  name: 'Ada',
  tags: ['admin'],
  greet() {
    return `Hi, ${this.name}`;
  },
  toJSON() {
    return JSON.stringify({ id: this.id, name: this.name });
  },
};

// ❌ 你可能这么写（改只读属性）：
//     ada.id = 2;
// 真实报错：
//     error TS2540: Cannot assign to 'id' because it is a read-only property.

// ❌ 你可能这么写（漏了必需属性）：
//     const bad: User = { name: 'Tom', tags: [], greet() {}, toJSON() {} };
// 真实报错：
//     error TS2741: Property 'id' is missing in type '{ name: string; tags: never[]; ... }'
//     but required in type 'User'.

// ❌ 你可能这么写（拼错字段名）：
//     const bad2: User = { id: 1, nickname: 'Tom', tags: [], greet() {}, toJSON() {} };
// 真实报错：
//     error TS2353: Object literal may only specify known properties,
//     and 'nickname' does not exist in type 'User'.

// 可选属性带来的连锁反应：拿到 age 必须自己处理 undefined
function describeAge(u: User): string {
  // ❌ return `他 ${u.age.toFixed(0)} 岁`;  -> TS18048: 'u.age' is possibly 'undefined'.
  return u.age === undefined ? '年龄未知' : `他 ${u.age.toFixed(0)} 岁`;
}

console.log('\n[8] object 类型');
console.log('[8] ada.greet() =', ada.greet());
console.log('[8] describeAge({...ada, age: 36}) =', describeAge({ ...ada, age: 36 }));
console.log('[8] describeAge(ada) =', describeAge(ada));

// 只读数组的运行时真相：readonly 只在编译期拦截
// ada.tags.push('vip');  -> TS2339: Property 'push' does not exist on type 'readonly string[]'.
const mutableTags = [...ada.tags]; // 想改就先复制一份
mutableTags.push('vip');
console.log('[8] 复制一份再改 =', mutableTags.join(','), '| 原数组没变 =', ada.tags.join(','));

// ============================================================
// 9. interface vs type：全面对比
// ============================================================
// 相同点：都能描述「对象长什么样」。
// 不同点（4 条，面试必考）：

// (1) type 能表达 interface 表达不了的东西：联合、元组、原始类型别名
type Status = 'idle' | 'loading' | 'done'; // 联合
type Pair = [number, string]; // 元组
type ID = string | number; // 原始类型别名
// interface Status = ...  ❌ 语法上就不允许

// (2) interface 会「声明合并」，type 同名直接报错
interface MergedShape {
  a: number;
}
interface MergedShape {
  b: string;
}
// 上面两个自动合并成 { a: number; b: string }
const merged: MergedShape = { a: 1, b: 'x' };

// ❌ 你可能这么写：
//     type Dup = { a: number };
//     type Dup = { b: number };
// 真实报错：
//     error TS2300: Duplicate identifier 'Dup'.
// 声明合并是给「第三方库扩展类型」用的，日常业务代码里别滥用。

// (3) interface 用 extends 多继承；type 用交叉类型 &
interface BaseA {
  a: number;
}
interface BaseB {
  b: string;
}
interface ChildI extends BaseA, BaseB {
  c: boolean;
}
type ChildT = BaseA & BaseB & { c: boolean };

const childI: ChildI = { a: 1, b: 'x', c: true };
const childT: ChildT = { a: 1, b: 'x', c: true };

// 冲突时的表现不同：interface extends 直接报错，type & 静默变成 never
//     interface ConfA { v: number }
//     interface ConfB { v: string }
//     interface ConfChild extends ConfA, ConfB {}   -> TS2320: cannot simultaneously extend
//     type ConfT = ConfA & ConfB;                   -> 不报错，但 v 的类型是 never

// (4) 性能：官方说 interface 之间有缓存，交叉类型是惰性的、可能被重复计算。
//     日常项目里你感觉不到；只有在超大代码库 + 大量交叉类型时才有差别。
//     所以「性能」不构成你选哪个的理由。

// 我的团队规范（可以直接抄）：
//   1. 描述对象形状（API 响应、组件 props、配置）-> interface
//   2. 联合类型 / 元组 / 函数类型 / 原始类型别名 -> type
//   3. 需要 extends 复用 -> interface；需要 & 拼装 -> type
//   4. 要给别人「声明合并」扩展（比如给 Express 的 Request 加字段）-> 必须 interface
//   5. 一个文件里保持一致，别同一件事两种写法混用

console.log('\n[9] interface vs type');
console.log('[9] merged =', JSON.stringify(merged));
console.log('[9] childI =', JSON.stringify(childI), '| childT =', JSON.stringify(childT));
console.log('[9] 同一个对象形状，两种写法产出的类型完全一样');

// ============================================================
// 10. 索引签名 [key: string]: T
// ============================================================
// 解决的问题：对象的 key 事先不知道（环境变量、字典、计数器）。
// 代价：一旦写上索引签名，所有属性都必须符合它。

interface Env {
  [key: string]: string; // 任何字符串 key，值都是 string
}
const env: Env = { NODE_ENV: 'development', API_URL: 'http://localhost' };
env.DYNAMIC_KEY = 'ok'; // 通过

// ❌ 你可能这么写（具体属性和索引签名类型不一致）：
//     interface Scores {
//       [subject: string]: number;
//       name: string;
//     }
// 真实报错：
//     error TS2411: Property 'name' of type 'string' is not assignable
//     to 'string' index type 'number'.
// 为什么：索引签名等于向调用者承诺「任何 key 拿到的都是 number」，
//        现在 name 是 string，这个承诺就破了。

// 坑 1：点号访问未知 key 会被拦（这是好事，逼你用正确的访问方式）
//     const v = env.WHATEVER;   -> TS4111: Property 'WHATEVER' comes from an index
//                                  signature, so it must be accessed with ['WHATEVER'].
const v1: string = env['WHATEVER']; // 方括号访问，类型是 string（不是 string | undefined）
console.log('[10] env["WHATEVER"] =', v1, '| 索引签名让你「撒谎」也不报错');

// 坑 2：索引签名会「吞掉」拼写检查
// env.NODE_ENV 写错成 env.NODE_ENVS 也不报错，因为任何字符串 key 都合法。
// 想要「已知 key 严格 + 额外 key 宽松」，用交叉类型（下一节）或先定义具体字段。

// 坑 3：对象字面量赋给索引签名类型时，具体属性可以被直接检查出来
const literal: { [k: string]: number } = { a: 1 };
// const badLiteral: { [k: string]: number } = { a: 'x' };
//   -> TS2322: Type 'string' is not assignable to type 'number'.

// 只读索引签名
interface FrozenDict {
  readonly [key: string]: number;
}
const frozenDict: FrozenDict = { a: 1 };
// frozenDict.a = 2;  -> TS2542: Index signature in type 'FrozenDict' only permits reading.
const frozenRead: number = frozenDict.a; // 读没问题

console.log('[10] literal =', JSON.stringify(literal), '| frozenDict.a =', frozenRead);

// ============================================================
// 11. 交叉类型 & ：合并类型，以及「冲突变 never」
// ============================================================
type Named = { name: string };
type Aged = { age: number };
type Person = Named & Aged; // 两个形状合并

const person: Person = { name: 'Tom', age: 18 };

// 冲突时取交集：string & number = never
type Conflict = { v: string } & { v: number };
// 后果 1：没法构造出合法值
// const bad: Conflict = { v: 'x' };  -> TS2322: Type 'string' is not assignable to type 'never'.
// 后果 2：读出来的类型是 never
// const conflict = {} as Conflict;
// const s: string = conflict.v;      -> TS2322: Type 'never' is not assignable to type 'string'.
// 只有 never 能接住 never
const neverValue: never = ({} as Conflict).v; // 运行时它只是个 undefined，类型上是 never

// 交叉类型的常见用途：给已有类型「打补丁」
type WithMeta<T> = T & { _meta: { fetchedAt: number } };
const userWithMeta: WithMeta<{ id: number }> = { id: 1, _meta: { fetchedAt: Date.now() } };

console.log('\n[11] 交叉类型');
console.log('[11] person =', JSON.stringify(person));
console.log('[11] userWithMeta =', JSON.stringify(userWithMeta));
console.log('[11] 冲突属性读出来是 never，运行时值是', neverValue);
console.log('[11] 冲突的交叉类型（string & number）会变成 never，构造不出来也读不出来');

// ============================================================
// 12. readonly 只防第一层（浅只读）
// ============================================================
interface Config {
  readonly server: { host: string; port: number }; // 只读的是「这个槽位」，不是里面的东西
  readonly name: string;
}

const cfg: Config = { server: { host: 'localhost', port: 80 }, name: 'prod' };

console.log('\n[12] readonly 是浅的');
console.log('[12] 想要深只读，得用 DeepReadonly<T>');

// ❌ cfg.server = { host: 'x', port: 1 };  -> TS2540 不能重新赋值
cfg.server.port = 8080; // ✅ 编译通过！readonly 只管第一层
cfg.server.host = 'db.internal'; // ✅ 也通过
console.log('[12] cfg.server.port =', cfg.server.port, '（readonly 没挡住我改深层字段）');

// 想连深层一起锁住，要自己写 DeepReadonly（第 06 章的映射类型）
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
const deepCfg: DeepReadonly<Config> = { server: { host: 'localhost', port: 80 }, name: 'prod' };
// deepCfg.server.port = 1;  -> TS2540: Cannot assign to 'port' because it is a read-only property.
console.log('[12] deepCfg.server.port =', deepCfg.server.port, '（DeepReadonly 才挡住深层）');

// Readonly<T> 也只是浅的：它只给第一层加只读，里面的 server 还是可变的
type ReadonlyConfig = Readonly<{ server: { host: string } }>;
const rc: ReadonlyConfig = { server: { host: 'localhost' } };
// rc.server = { host: 'x' };  -> TS2540: Cannot assign to 'server' because it is a read-only property.
rc.server.host = 'x'; // ✅ 深一层照样能改
console.log('[12] Readonly<T> 同样只锁第一层，rc.server.host 可以改成', rc.server.host);

// ============================================================
// 13. 空对象 {} / object / Record<string, never> 的区别
// ============================================================
// 面试高频：`{}` 不是「空对象」，而是「除 null 和 undefined 外的任何值」。

const e1: {} = 'string 也能赋给 {}';
const e2: {} = 42;
const e3: {} = () => {};
const e4: object = { a: 1 };
// const e5: object = 'str';        -> TS2322: Type 'string' is not assignable to type 'object'.
// const e6: object = 42;           -> TS2322: Type 'number' is not assignable to type 'object'.
// const e7: {} = null;             -> TS2322: Type 'null' is not assignable to type '{}'.
// const e8: {} = undefined;        -> TS2322: Type 'undefined' is not assignable to type '{}'.

// 真想要「必须是空对象」，用 Record<string, never>
const empty: Record<string, never> = {};
// const notEmpty: Record<string, never> = { a: 1 };
//   -> TS2322: Type 'number' is not assignable to type 'never'.

// 想表达「任意对象」用 Record<string, unknown>，可读性和安全性都更好
const anyObj: Record<string, unknown> = { a: 1, b: 'x', c: [1] };

// 类型别名，用来演示「只导入类型」的写法（verbatimModuleSyntax 要求 import type）
type FileStats = Pick<Stats, 'size' | 'mtimeMs'>;

console.log('\n[13] {} / object / Record<string, never>');
console.log('[13] const e1: {} = "字符串" 是合法的！{} 表示「除 null/undefined 外的任何值」');
console.log('[13] e4 =', JSON.stringify(e4), '| empty =', JSON.stringify(empty));
console.log('[13] anyObj keys =', Object.keys(anyObj).join(','));

// ============================================================
// 14. 实战：类型安全的 ApiClient
// ============================================================
// 目标：改一个字段，所有用错的地方立刻变红。

interface ApiClientConfig {
  baseUrl: string;
  timeout?: number; // 可选参数
  headers?: Record<string, string>;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// 请求选项：泛型 + 可选 + 只读
interface RequestOptions {
  readonly method?: HttpMethod;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

// 我们的客户端接口：get / post 都带泛型
interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T, B = unknown>(path: string, body: B, options?: RequestOptions): Promise<T>;
}

// --- 实现（用模拟请求，方便直接跑） ---
function createApiClient(config: ApiClientConfig): ApiClient {
  const base = config.baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, options?: RequestOptions): Promise<T> {
    void options; // 演示用，真实实现会用到
    const raw = await fakeFetch(path);
    if (raw === undefined) {
      throw new Error(`${base}${path} 返回了空数据`);
    }
    return raw as T; // 边界处：外部数据进来到此为止，之后都是类型安全的
  }

  return {
    get<T>(path: string, options?: RequestOptions): Promise<T> {
      return request<T>(path, options);
    },
    post<T, B = unknown>(path: string, body: B, options?: RequestOptions): Promise<T> {
      void body;
      return request<T>(path, options);
    },
  };
}

// 关键一步：给后端响应定义类型。这一步做了，后面全是自动的。
interface UserDTO {
  id: number;
  name: string;
  tags: string[];
}

const api = createApiClient({ baseUrl: 'https://api.example.com/', timeout: 5000 });

const user = await api.get<UserDTO>('/user/1'); // T 由调用点指定
console.log('\n[14] ApiClient');
console.log('[14] user.name =', user.name.toUpperCase());
console.log('[14] user.tags =', user.tags.join(','));

// 「改一个字段所有调用点报错」的体验：
// 假设后端把 name 改成了 nickname，你把 UserDTO 改成：
//     interface UserDTO { id: number; nickname: string; tags: string[] }
// 那么下面这行立刻报错：
//     console.log(user.name);   -> TS2339: Property 'name' does not exist on type 'UserDTO'.
// 而且 api.get<UserDTO> 的返回值类型也跟着变 —— 不用你去全局搜索。
//
// 反过来的一个「反直觉」点：多写字段不报错，缺字段才报错。
//     renderUser({ id: 1, nickname: 'Tom' });  -> TS2353 多写了字段（对象字面量检查）
//     const tmp = { id: 1, nickname: 'Tom' };
//     renderUser(tmp);                          -> ✅ 不报错（不是字面量，只做结构检查）
// 这就是「多余属性检查」只针对对象字面量的原因（第 02 章练习 3 考过）。

// 用 satisfies 校验调用点传的参数，同时保留字面量推断
const health = await api.get<{ ok: boolean; uptime: number }>('/health');
const healthText = `ok=${health.ok} uptime=${health.uptime.toFixed(1)}s`;
console.log('[14] health =', healthText);

// POST：第二个泛型参数是 body 的类型，可以显式给，也可以让 TS 推断
interface CreateUserBody {
  name: string;
  tags?: string[];
}
const created = await api.post<UserDTO, CreateUserBody>('/user/1', { name: 'Grace', tags: ['dev'] });
console.log('[14] created.name =', created.name);

console.log('\n========== 第 03 章结束：函数类型 + 对象类型 ==========');
