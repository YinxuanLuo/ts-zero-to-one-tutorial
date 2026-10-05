/**
 * 01 — 环境搭建 + TypeScript 的心智模型（配套可运行代码）
 *
 * 怎么跑：
 *   node 01-心智模型.ts
 *   npx tsc --noEmit        （或 pnpm exec tsc --noEmit）
 *
 * 这个文件里所有「报错演示」都写在注释里，所以它本身是能通过检查的。
 */

console.log('========== 第 01 章：TypeScript 的心智模型 ==========');
console.log('[环境] Node:', process.version);

// ============================================================
// 0. 计时器：用来证明「类型不产生任何运行时开销」
// ============================================================
const t0 = performance.now();

// ============================================================
// 1. 类型擦除（type erasure）—— 全章最重要的一节
// ============================================================
// 下面这些 interface / type 在运行时「一个字节都不存在」。
// 它们是写给编译器和同事看的，不是写给 Node 看的。

interface User {
  readonly id: UserId; // 只读属性：运行时同样不存在
  name: string;
  age: number;
  email?: string; // ? 表示可选，运行时不存在
}

type UserId = string | number; // 类型别名：运行时不存在

// 函数上的 : User 和 : string 也全部会被擦掉
function greet(user: User): string {
  return `你好，${user.name}（${user.id} 号）`;
}

const ada: User = { id: 1, name: 'Ada', age: 36 };

console.log('\n[1] 类型擦除');
console.log('[1] greet(ada) =', greet(ada));
console.log('[1] 运行时 typeof ada =', typeof ada);
console.log('[1] 运行时 Object.keys(ada) =', Object.keys(ada).join(', '));
// 注意：上面只打印出 id, name, age —— 类型从来不是真实存在的数据

// ============================================================
// 2. 编译期 vs 运行期：一堵看不见的墙
// ============================================================

// --- 2.1 interface 不能拿来 instanceof ---
// ❌ 你可能这么写：
//     interface Animal { name: string }
//     const a: Animal = { name: 'dog' };
//     console.log(a instanceof Animal);
//
// 真实报错（tsc）：
//     error TS2693: 'Animal' only refers to a type, but is being used as a value here.
//
// 为什么？因为 interface 被擦除了，运行时 Animal 这个东西根本不存在。
// 想在运行时判断「是不是这个形状」，只能看真实存在的值（class、对象、typeof）。

console.log('\n[2] 编译期 vs 运行期');

// --- 2.2 运行时的真实数据，类型系统管不着 ---
// JSON.parse 的返回类型是 any，我强行「声明」它是 User 的形状。
// 编译器信了我的话，但真实数据可以是任何东西。
const fakeUser = JSON.parse('{"id":2}') as User;
// 这一行编译通过（因为 User 上写着 name: string），
// 但运行时会崩，因为服务器根本没返回 name。
try {
  console.log('[2] fakeUser.name.toUpperCase() =', fakeUser.name.toUpperCase());
} catch (err) {
  console.log('[2] 崩了 ->', (err as Error).message);
  console.log('[2] 类型写着 string，运行时其实是', typeof fakeUser.name);
}

// --- 2.3 类型只在「赋值那一刻」被检查，之后就没人管了 ---
const scores: number[] = [90, 80];
// 下面这行能过检查，因为 push 的声明参数是 number……
// ❌ 你可能这么写：scores.push('oops');
// 真实报错（tsc）：
//     error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
console.log('[2] scores 目前是', JSON.stringify(scores));

// --- 2.4 运行时防护必须自己写 ---
// 类型在运行时没了，所以「来自外部的数据」必须手动检查。
function readName(input: unknown): string {
  if (typeof input === 'object' && input !== null && 'name' in input) {
    const name = (input as { name: unknown }).name;
    if (typeof name === 'string') return name; // 这才是运行时的真检查
  }
  return '匿名用户';
}
console.log('[2] readName({}) =', readName({}));
console.log('[2] readName({name:"Bob"}) =', readName({ name: 'Bob' }));

// ============================================================
// 3. 注解（annotation）vs 推断（inference）
// ============================================================
// 注解 = 我手写类型；推断 = TypeScript 自己看出来的类型。
// 第一哲学：能推断出来的，绝不多写一个字。

console.log('\n[3] 注解 vs 推断');

// 坏品味：右边已经明明白白，还手写一遍
const badName: string = 'Ada';
const badList: string[] = ['a', 'b'];
const badFn = (x: number): number => x * 2;

// 好品味：让编译器自己看
const goodName = 'Ada'; // 推断为 "Ada"（字面量类型，比 string 更精确）
const goodList = ['a', 'b']; // 推断为 string[]
const goodFn = (x: number) => x * 2; // 返回类型推断为 number

console.log('[3] badName =', badName, '| badList =', badList.join('/'), '| badFn(2) =', badFn(2));
console.log('[3] goodName =', goodName, '| goodList =', goodList.join('/'), '| goodFn(2) =', goodFn(2));

// 什么时候「必须」手写注解？
// 1) 函数参数（编译器没有线索，strict 模式下不写就是隐式 any 报错）
// 2) 变量先声明后赋值（let x; 推断为 any）
// ❌ 你可能这么写：function add(a, b) { return a + b }
// 真实报错（tsc，strict 模式）：
//     error TS7006: Parameter 'a' implicitly has an 'any' type.
//     error TS7006: Parameter 'b' implicitly has an 'any' type.
// 3) 空数组、需要收窄的联合类型等推断不出来或推得太宽的场景
const needAnnotation: number[] = []; // 不写就是 any[]
needAnnotation.push(1);
console.log('[3] needAnnotation =', JSON.stringify(needAnnotation));

// ============================================================
// 4. 结构化类型（structural typing）—— 看形状，不看名字
// ============================================================
// 类比：机场安检看的是「包里有没有违禁品」，不是「包是什么牌子」。

console.log('\n[4] 结构化类型');

interface Point {
  x: number;
  y: number;
}

// 这个对象从来没说自己「是 Point」，但它形状对得上，就放行。
const loose = { x: 1, y: 2 };
const asPoint: Point = loose;
console.log('[4] loose 赋给 Point 成功 ->', asPoint.x, asPoint.y);

// 反例：直接写对象字面量时，TS 会额外做「多余属性检查」
// ❌ 你可能这么写：const p: Point = { x: 1, y: 2, z: 3 };
// 真实报错（tsc）：
//     error TS2353: Object literal may only specify known properties,
//     and 'z' does not exist in type 'Point'.
//
// 拼错属性名也会被抓：
// ❌ const c: { apiUrl: string } = { apiURL: 'http://x' };
//     error TS2561: Object literal may only specify known properties,
//     but 'apiURL' does not exist in type '{ apiUrl: string; }'.
//     Did you mean to write 'apiUrl'?

// 实例之间也一样：只要形状满足，就允许赋值。
class Dog {
  name = 'dog';
  speak(): string {
    return 'woof';
  }
}
class Robot {
  name = 'robot';
  speak(): string {
    return 'beep';
  }
}
// Robot 没有继承 Dog，也没有实现任何 Dog 的接口，但它有 name 和 speak，
// 所以在 TS 眼里它「就是」Dog。
const pretendDog: Dog = new Robot();
console.log('[4] new Robot() 赋给 Dog ->', pretendDog.speak());

// ============================================================
// 5. 渐进式：先在 JS 里写，再慢慢加类型
// ============================================================
// TS 的类型是「可选的、可退出的」。同一个项目里可以既有纯 JS 文件，
// 又有写满类型的 TS 文件，还能用 unknown / any 留一个「待办」的口子。

console.log('\n[5] 渐进式迁移');

// 阶段一：完全是 JS 写法，只留一个未知类型
function parseScore(raw: unknown): number {
  // 阶段二：用 typeof 收窄，把未知变成已知
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
  }
  // 阶段三：兜底，永不抛异常
  return 0;
}
console.log('[5] parseScore(88) =', parseScore(88));
console.log('[5] parseScore("88") =', parseScore('88'));
console.log('[5] parseScore({}) =', parseScore({}));

// ============================================================
// 6. 常用「擦除语法」清单（这些在运行时会消失）
// ============================================================
//   interface X {}            -> 消失
//   type X = ...              -> 消失
//   变量/参数/返回值的 : T     -> 消失
//   as T                      -> 消失（危险：它只是「说服」编译器）
//   satisfies T               -> 消失（只做检查，不改变推断结果）
//   import type { A } from    -> 消失（整条 import 被删掉）
//   declare ...               -> 消失（只用来描述外部环境）
//
// 而这些「不是纯擦除」的语法，Node 直跑会拒绝：
//   enum / namespace / 构造函数参数属性 / 老式 import = require
// 真实报错（node 00-enum-probe.ts）：
//   SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]:
//   TypeScript enum is not supported in strip-only mode
// 解决：改成 const 对象 + union，或者加 --experimental-transform-types。

// const 对象 + 联合类型 = 运行时和类型都在，是 enum 的现代替代品
const Role = {
  Admin: 'admin',
  User: 'user',
} as const;
type Role = (typeof Role)[keyof typeof Role]; // 类型侧：'admin' | 'user'

function describeRole(role: Role): string {
  return role === Role.Admin ? '管理员' : '普通用户';
}
console.log('\n[6] const 对象代替 enum');
console.log('[6] describeRole(Role.Admin) =', describeRole(Role.Admin));
console.log('[6] 运行时 Role 依然是一个真对象 ->', JSON.stringify(Role));

// ============================================================
// 7. 收尾：证明类型零开销
// ============================================================
const elapsed = performance.now() - t0;
console.log('\n[7] 整个文件跑完，耗时约', elapsed.toFixed(2), 'ms');
console.log('[7] 全部类型在 Node 加载前就被剥掉了，一个字节都没运行');
console.log('========== 第 01 章结束 ==========');
