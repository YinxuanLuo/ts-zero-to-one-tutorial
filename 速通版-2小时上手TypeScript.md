# TypeScript 速通版 · 2 小时上身

> **这份文件是给"我现在就要用"的人准备的。**
>
> `docs/` 里的 12 章是"讲透版"，完整读完约 15~20 小时。
> 这份速通版只讲**日常写业务代码真正会用到的 20%**，读完约 2 小时。
>
> 两套内容是兼容的：速通版读完后想深入哪一块，直接跳到对应章节。
> 每节末尾的 `→ 深入：第 XX 章` 就是路标。

---

## 目录

- [0. 先建立心智模型（5 分钟）](#0-先建立心智模型5-分钟)
- [1. 类型基础速查（20 分钟）](#1-类型基础速查20-分钟)
- [2. 收窄与判别联合 ★最重要（40 分钟）](#2-收窄与判别联合-最重要40-分钟)
- [3. 泛型（30 分钟）](#3-泛型30-分钟)
- [4. 工具类型与类型体操够用版（20 分钟）](#4-工具类型与类型体操够用版20-分钟)
- [5. 五个必须知道的配置（10 分钟）](#5-五个必须知道的配置10-分钟)
- [6. 十二个必踩的坑（15 分钟）](#6-十二个必踩的坑15-分钟)
- [7. 一页速查表（5 分钟）](#7-一页速查表5-分钟)
- [8. 自测 20 题（15 分钟）](#8-自测-20-题15-分钟)

---

## 0. 先建立心智模型（5 分钟）

### 三句话

1. **类型只活在"写代码的时候"，编译完就没了。** 这叫**类型擦除**。
2. **TypeScript 有两个世界：类型空间和值空间。** 报错看不懂时，先问"我现在在哪个世界"。
3. **类型是"意图说明 + 廉价的第一道防线"，不是安全保证。** 外部数据它一点都管不了。

### 三条推论，能解释你 90% 的困惑

```ts
// 推论 1：类型不影响运行时 → 类型不会让代码变慢
type Foo = { a: string };
// 编译后这一行完全消失

// 推论 2：interface 只活在类型空间 → 不能 instanceof
interface User { name: string }
// if (x instanceof User) {}   // ❌ TS2693: 'User' only refers to a type

// 推论 3：泛型也是类型 → 不能 new T()
function make<T>() { return new T(); }   // ❌ TS2693
```

### 一个必须背下来的事实

```ts
const data = JSON.parse('{}');
//    ^? any   ← 外部数据完全不受保护！
```

**所有从外面进来的东西（接口返回、localStorage、用户输入、`JSON.parse`、`catch` 变量）都标成 `unknown`，然后收窄。**

### 判断"该写多少类型"的两个原则

1. **能推断就不写**：局部变量、内部函数返回值，让它推断。
2. **函数参数必须写**：这是编译器的盲区。

```ts
const n = 1;                        // ✅ 不写
const n2: number = 1;               // ❌ 多余

function add(a: number, b: number) { // ✅ 参数必须写
  return a + b;                      // ✅ 返回值让它推断
}

export function api(): User { }      // ✅ 导出的 API 显式写返回值
```

> → 深入：第 00 章《设计哲学》、第 01 章《环境与心智模型》

---

## 1. 类型基础速查（20 分钟）

### 1.1 原始类型

```ts
let s: string = 'a';
let n: number = 1;          // 整数和小数都是 number
let b: boolean = true;
let big: bigint = 1n;
let sym: symbol = Symbol('x');
let u: undefined = undefined;
let nul: null = null;
```

**必须记住的三条：**

| 坑 | 说明 |
|---|---|
| **用小写 `string`，不要用 `String`** | `String` 是包装对象，`const s: string = new String('x')` 报 TS2322 |
| **`null` 和 `undefined` 是独立类型** | 开了 `strictNullChecks` 后，它们**不能**赋给 `string`。这是 TS 最值钱的开关 |
| **`number` 不区分整数/小数** | `1`、`1.5`、`NaN`、`Infinity` 都是 `number` |

### 1.2 数组、元组、只读数组

```ts
let arr: string[] = ['a'];              // 数组：一堆同类
let arr2: Array<string> = ['a'];        // 完全等价

let pair: [string, number] = ['a', 1];  // 元组：几个，每个位置类型固定
// pair[0] = 1;                          // ❌ TS2322
// pair[9];                              // ❌ TS2493 越界（元组才会报！）

function sum(nums: readonly number[]): number {  // 只读：承诺不改调用者的数据
  return nums.reduce((a, b) => a + b, 0);
}
```

**元组在哪见？** `const [count, setCount] = useState(0)`、`const [user, posts] = await Promise.all([...])`。

### 1.3 对象类型

```ts
type Config = {
  readonly apiUrl: string;   // 只读
  timeout?: number;          // 可选 = number | undefined
};

const cfg: Config = { apiUrl: 'https://x.com' };
const t = cfg.timeout ?? 3000;   // 可选属性用之前必须处理
```

**多余属性检查**（面试题）：

```ts
type P = { x: number; y: number };

const p1: P = { x: 1, y: 2, z: 3 };   // ❌ TS2353 报错
const tmp = { x: 1, y: 2, z: 3 };
const p2: P = tmp;                     // ✅ 不报错
```

**为什么？** 直接写对象字面量时，多出的字段几乎必然是拼写错误，所以 TS 要抓；
而变量赋值走的是普通的"结构兼容"判断，宽一点是合理的。

### 1.4 四个特殊类型（背下来）

| 类型 | 人话 | 什么时候用 | 危险度 |
|---|---|---|---|
| `any` | 我不知道，你随便动 | **几乎永远不用**，只在迁移旧 JS 时当临时逃生舱 | 危险，会传染 |
| `unknown` | 我不知道，你别乱动 | **所有外部数据**（`JSON.parse`、接口返回、`catch` 变量） | 安全 |
| `never` | 一个值都没有 | 永不返回的函数、穷尽检查 `assertNever` | 安全 |
| `void` | 返回了，但没值 | 事件回调、`forEach` | 安全 |

```ts
// unknown 必须先收窄
function handle(input: unknown): string {
  if (typeof input === 'string') return input.toUpperCase();
  if (typeof input === 'number') return input.toFixed(2);
  return String(input);
}
```

```ts
// never 的杀手级用途：穷尽检查
function assertNever(x: never): never {
  throw new Error(`分支未穷尽: ${JSON.stringify(x)}`);
}
```

> **`assertNever` 是你这一整份教程里最该养成的习惯。**
> 它把"忘记处理新分支"这个运行时事故，变成编译期红灯。

### 1.5 类型推断：为什么你大部分时候不用写类型

```ts
const a = 1;              // 字面量类型 1（const 锁死了）
let b = 1;                // number（let 可能被改）
const c = [1, 'a'];       // (string | number)[]
const d = { x: 1 };       // { x: number }

const strs = [1, 2, 3].map((n) => String(n));
//                              ^? n 是 number，TS 从 map 的签名倒推给你的
//                               这叫"上下文推断"
```

**必须手写类型的四种情况：**

1. 函数参数（`noImplicitAny` 会强制你写）
2. 空数组 `const a: string[] = []`（否则是 `any[]`）
3. 导出的 API 返回值（这是契约）
4. 从外部来的数据（标 `unknown`）

> → 深入：第 02 章《类型基础与推断》

---

## 2. 收窄与判别联合 ★最重要（40 分钟）

> **这一节是整份速通版的核心。**
> 你在业务代码里写的类型，80% 都属于这一节。

### 2.1 联合类型与字面量类型

```ts
type Direction = 'up' | 'down' | 'left' | 'right';

let d: Direction = 'up';
// d = 'north';   // ❌ TS2322

// 从数组推出联合类型（超实用，数组和类型永不脱节）
const COLORS = ['red', 'green', 'blue'] as const;
type Color = (typeof COLORS)[number];
//   ^? "red" | "green" | "blue"
```

### 2.2 收窄：TypeScript 最像人的地方

**核心思想**：变量的类型**不是固定的**，它跟着你的 `if` 一步步缩小。

```ts
function f(x: string | number) {
  // 此刻 x 可能是 string 或 number
  if (typeof x === 'string') {
    // 此刻 x 一定是 string
    x.toUpperCase();
  }
  // 出了 if 又回到 string | number
}
```

> **类比**：机场安检。保安一开始觉得你"可能是员工、访客、送货的"。
> 你刷了员工卡，他立刻把"访客、送货的"划掉。
> **他从不问你是什么身份，他只看你做了什么。** TS 也一样。

**规则：联合类型上，不收窄就只能访问所有成员共有的属性。**

```ts
type Pet = { meow(): string } | { bark(): string };
function play(p: Pet) { return p.meow(); }
```

```text
error TS2339: Property 'meow' does not exist on type 'Pet'.
  Property 'meow' does not exist on type '{ bark(): string; }';
```

**读报错的技巧**：从最后一行往上读。最后一行告诉你**具体是哪个成员**出了问题。

### 2.3 收窄的十种手段（背这张表）

| 手段 | 例子 | 适用 |
|---|---|---|
| `typeof` | `typeof x === 'string'` | 原始类型 |
| 真值判断 | `if (x) {}` | ⚠️ 会同时排除 `''` / `0` / `false` |
| `!= null` | `if (x != null) {}` | ✅ 同时排除 `null` 和 `undefined`，推荐 |
| 相等比较 | `x === 'a'` | 字面量联合 |
| `in` | `'meow' in pet` | 判属性存在，**最常用** |
| `instanceof` | `x instanceof Date` | 只能用于 class，不能用于 interface |
| `Array.isArray` | `Array.isArray(x)` | 数组 |
| `switch` | `switch (s.status)` | 判别联合 |
| `x is T` | `function isUser(v): v is User` | 自定义，唯一能自己定义收窄的手段 |
| `asserts x is T` | `function assert(v): asserts v is User` | 检查失败就抛错 |

**两个必须记住的坑：**

```ts
// 坑 1：typeof null === 'object'
if (typeof x === 'object' && x !== null) { /* 这里 x 才是真的对象 */ }

// 坑 2：if (x) 吃掉空字符串
greet('');   // 用 if (x) 判断会走到"没有名字"的分支
```

### 2.4 自定义类型谓词 `x is T`

**唯一能让你自己定义收窄规则的手段。**

```ts
interface User { id: number; name: string }

// 关键是返回类型写 `value is User`，而不是 `boolean`
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'number' &&
    'name' in value &&
    typeof (value as { name: unknown }).name === 'string'
  );
}

function handle(input: unknown) {
  if (isUser(input)) {
    input.name.toUpperCase();   // 这里 input 是 User 了
  }
}
```

**⚠️ 类型谓词是"承诺"，编译器不会验证你的实现。**
写漏了检查，编译期不会有任何提示，运行时才炸。

### 2.5 判别联合 ★★★ 这一整节的王牌

#### 先看坏例子

```ts
// ❌ 非法状态可以被表示
interface BadState {
  loading?: boolean;
  data?: string[];
  error?: string;
}
```

**这些荒谬的组合编译器全都不拦：**

```ts
const s1: BadState = { loading: true, data: ['x'], error: '失败了' };  // 又在加载又有数据又报错？
const s2: BadState = {};                                              // 什么都没有？
```

于是你只能靠人脑记"哪些组合合法"，然后写满防御性 `if`——**永远写不完**。

#### 判别联合：让非法状态写不出来

```ts
// ✅ 每种情况一个精确形状，用字面量字段区分
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: string[] }
  | { status: 'error'; error: string };
```

**那些荒谬组合现在一个字都写不出来：**

```ts
const s1: State = { status: 'loading', data: [] };
```

```text
error TS2353: Object literal may only specify known properties,
  and 'data' does not exist in type '{ status: "loading"; }'.
```

```ts
const s2: State = { status: 'success' };
```

```text
error TS2741: Property 'data' is missing in type '{ status: "success"; }'
  but required in type '{ status: "success"; data: string[]; }'.
```

#### 用起来是什么感觉

```ts
function render(state: State): string {
  switch (state.status) {
    case 'idle':    return '还没开始';
    case 'loading': return '加载中...';
    case 'success': return `拿到 ${state.data.length} 条`;  // ← 不需要 ?. 也不需要 !
    case 'error':   return `出错：${state.error}`;          // ← error 直接可用
    default:        return assertNever(state);              // ← 漏分支立刻报错
  }
}
```

**三个巨大好处：**

1. **不需要 `?.` 和 `!`**——进了 `case 'success'`，`state.data` 就是 `string[]`，编译器已经证明了。
2. **不可能漏分支**——`assertNever` 兜底。
3. **加新状态时，所有处理点自动编译报错**——重构时的救命稻草。

#### 判断标准 ★

> **如果你在写 `if (a && !b && c)` 这种"组合条件"，八成应该改成判别联合。**

#### 三个实战场景

```ts
// ① API 响应
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; statusCode: number };

// ② UI 状态机
type FormState =
  | { kind: 'editing'; values: Record<string, string> }
  | { kind: 'submitting'; values: Record<string, string> }
  | { kind: 'success'; id: string }
  | { kind: 'failure'; message: string };

// ③ Redux / Zustand 的 action
type Action =
  | { type: 'todos/add'; payload: { text: string } }
  | { type: 'todos/toggle'; payload: { id: string } }
  | { type: 'todos/remove'; payload: { id: string } };
```

**判别属性必须是字面量类型。** 写成 `status: string` 就完全失效了。

### 2.6 可选链与空值合并（配合收窄）

```ts
type User = { name: string; address?: { city: string } };

user.address?.city          // string | undefined

// ⭐ 默认值一律用 ??，不要用 ||
const port = config.port ?? 3000;
// config.port 是 0 → 得到 0 ✅
const port2 = config.port || 3000;
// config.port 是 0 → 得到 3000 ❌ 线上事故高发区
```

**`?.` 用多了，通常说明类型定义不准确。** 如果按业务它就是必须有的，改类型，别撒 `?.`。

**`!` 非空断言**和 `as` 一样是"承诺"。更好的写法：

```ts
const el = document.getElementById('app');
if (!el) throw new Error('#app 不存在');
el.innerHTML = 'hi';    // 收窄了，不需要 !
```

> → 深入：第 04 章《联合类型与类型收窄》（全教程最重要的一章）

---

## 3. 泛型（30 分钟）

### 3.1 泛型的本质（一句话）

> **泛型的作用不是"能接受任何类型"，而是"能建立类型之间的关系"。**

对比一下：

```ts
// ❌ any：输入输出之间没有任何关系
function bad(x: any): any { return x; }
const a = bad(42);   // a 是 any，类型信息全丢

// ✅ 泛型：输出必须和输入"是同一个 T"
function good<T>(x: T): T { return x; }
const b = good(42);  // b 是 42，类型完整保留
```

**证明"关系真的存在"：**

```ts
function pair<T>(first: T, second: T): [T, T] { return [first, second]; }

pair(1, 2);      // ✅
pair('a', 'b');  // ✅
pair(1, 'b');    // ❌ TS2345：两个参数必须是同一种 T
```

**这个约束 `any` 永远表达不了。**

### 3.2 泛型用在哪

```ts
// ① 函数
function first<T>(arr: T[]): T | undefined { return arr[0]; }

// ② 接口 / 类型别名（实战最常见）
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
type UserResp = ApiResponse<{ id: number; name: string }>;

// ③ 类
class Stack<T> {
  private items: T[] = [];
  push(item: T): void { this.items.push(item); }
  pop(): T | undefined { return this.items.pop(); }
}
```

### 3.3 约束 `T extends U`

**问题**：无约束的 `T` 什么都不能做。

```ts
function getName<T>(obj: T) { return obj.name; }
```

```text
error TS2339: Property 'name' does not exist on type 'T'.
```

**原因**：`T` 可以是任何东西，包括 `number`。要访问属性，你必须证明这个形状存在。

```ts
function getName<T extends { name: string }>(obj: T): string {
  return obj.name;   // ✅
}
```

读作："**`T` 可以是任何类型，只要它至少长得像 `{ name: string }`。**"

**⚠️ 泛型里的 `extends` ≠ 类继承的 `extends`。**
它的准确含义是"T 必须能赋值给 U"。因为 TS 是结构化类型，所以看形状：

```ts
function logX<T extends { x: number }>(p: T) {}
logX({ x: 1, y: 2 });   // ✅ 对象字面量也行，毫无继承关系
```

### 3.4 黄金组合：`K extends keyof T` + `T[K]` ★

这是泛型里最实用的一招，几乎所有类型安全的工具函数都用它：

```ts
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: 'Tom', active: true };
const id = get(user, 'id');      // number
const name = get(user, 'name');  // string
// get(user, 'nmae');            // ❌ TS2345，拼错立刻报错
```

逐字拆解：

- `T`：对象的类型（自动从 `user` 推断）
- `K extends keyof T`：K 必须是 T 的某个键名（`'id' | 'name' | 'active'`）
- `T[K]`：T 中键 K 对应的值的类型（索引访问类型）

### 3.5 泛型的常见误用（面试爱问）

```ts
// ❌ 误用 1：T 只出现一次 = 白写，等价于 unknown 但更啰嗦
function log<T>(value: T): void { console.log(value); }
// ✅ 直接写 unknown
function log2(value: unknown): void { console.log(value); }

// ❌ 误用 2：用 as any 处理 T = 泛型成了装饰
function bad2<T>(data: T): T { (data as any).whatever(); return data; }

// ❌ 误用 3：超过 3 个类型参数，说明设计该拆了
```

**判断标准：`T` 至少要出现两次（或出现在约束关系里）才有意义。**

### 3.6 `any` / `unknown` / 泛型 怎么选

```
要接受任何东西吗？
  ├─ 不要 → 写具体类型
  └─ 要
      ├─ 输入输出之间有关系吗？（进来的类型要影响出去的类型）
      │    ├─ 有 → 用泛型 <T>
      │    └─ 没有 → 用 unknown（绝不用 any）
```

> → 深入：第 05 章《泛型》

---

## 4. 工具类型与类型体操够用版（20 分钟）

> **这一节的目标是"能读懂 + 能抄改"，不是"能自创"。工作中 95% 的时间你只需要读懂。**

### 4.1 五个基础操作符

```ts
type User = { id: number; name: string; email: string };

// keyof：取出所有键名组成联合类型（"列出所有列名"）
type K = keyof User;                    // 'id' | 'name' | 'email'

// typeof（类型位置）：把值变成类型（"拍张照片存成图纸"）
const config = { host: 'localhost', port: 8080 };
type Config = typeof config;            // { host: string; port: number }

// 索引访问 T[K]：取某个属性的类型
type IdType = User['id'];               // number
type AnyValue = User[keyof User];       // number | string

// as const：把值锁成最窄的字面量类型
const ROUTES = { home: '/', user: '/u/:id' } as const;
// typeof ROUTES.home 是 "/"，不是 string
```

**⚠️ 类型位置的 `typeof` 和值位置的 `typeof` 是两个东西：**

```ts
const t = typeof user;    // 值位置：JS 运算符，返回字符串 "object"
type T = typeof user;     // 类型位置：类型查询，返回类型 { name: string }
```

### 4.2 必会工具类型（21 个里挑 10 个高频的）

```ts
interface User {
  id: number;
  name: string;
  email: string;
}

Partial<User>             // 全部变可选 —— 更新表单
Required<User>            // 全部变必填
Readonly<User>            // 全部变只读
Pick<User, 'id' | 'name'> // 只保留指定键 —— DTO
Omit<User, 'email'>       // 去掉指定键 —— 脱敏
Record<string, number>    // 造字典
Exclude<'a'|'b'|'c', 'a'> // 'b' | 'c'
Extract<'a'|'b'|1, string>// 'a' | 'b'
NonNullable<string | null>// string
ReturnType<() => void>    // void
Parameters<(a: number) => void>  // [a: number]
Awaited<Promise<string>>  // string
```

**实战里最高频的三个：**

```ts
// ① Partial：更新接口的 patch 参数
function updateUser(id: number, patch: Partial<User>): Promise<User> { }
updateUser(1, { name: 'Tom' });   // 只传要改的字段

// ② Pick：列表接口只返回部分字段
type UserListItem = Pick<User, 'id' | 'name'>;

// ③ Omit：创建时不需要 id（后端生成）
type CreateUserDto = Omit<User, 'id'>;
```

### 4.3 手写它们（面试白板必考）

```ts
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyRequired<T> = { [K in keyof T]-?: T[K] };          // -? 去掉可选
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
type MyRecord<K extends keyof any, V> = { [P in K]: V };
type MyExclude<T, U> = T extends U ? never : T;
type MyExtract<T, U> = T extends U ? T : never;
type MyNonNullable<T> = T extends null | undefined ? never : T;
type MyReturnType<T> = T extends (...args: never[]) => infer R ? R : never;
type MyParameters<T> = T extends (...args: infer P) => unknown ? P : never;
```

**看懂 `[K in keyof T]` 就是"映射类型"（批量给每一列套一个函数）。**

### 4.4 两个必须知道的机制

**① 分布式条件类型**

当条件类型的检查对象是**裸类型参数**且传入联合类型时，TS 会**对每个成员分别求值再合并**：

```ts
type MyExclude<T, U> = T extends U ? never : T;
type R = MyExclude<'a' | 'b' | 'c', 'a'>;
// 分发过程：
//   'a' extends 'a' ? never : 'a'  → never
//   'b' extends 'a' ? never : 'b'  → 'b'
//   'c' extends 'a' ? never : 'c'  → 'c'
// 合并 never | 'b' | 'c' = 'b' | 'c'
```

**阻止分发**：把参数包进元组，它就不再是"裸"的：

```ts
type NoDistribute<T, U> = [T] extends [U] ? 'yes' : 'no';
```

**② `infer`：就地取出一个类型**

```ts
type Unwrap<T> = T extends Promise<infer U> ? U : T;
type A = Unwrap<Promise<number>>;   // number

// 递归版（Awaited 的思路）
type DeepUnwrap<T> = T extends Promise<infer U> ? DeepUnwrap<U> : T;
type B = DeepUnwrap<Promise<Promise<string>>>;   // string
```

### 4.5 什么时候不该玩类型体操

**类型是给人读的。复杂度有预算。**

| 该写 | 不该写 |
|---|---|
| 官方工具类型能解决的 | 为了炫技手写 8 层嵌套条件类型 |
| 给一个复杂类型起名字 | 把类型内联在一行里 |
| 加一行中文注释说明意图 | 让同事需要 10 分钟才能读懂 |
| 报错信息仍然可读 | 报错变成 `Type instantiation is excessively deep` |

**经验**：优先用官方工具类型；优先拆成多个具名 `type`；加注释。

> → 深入：第 06 章《类型体操够用版》

---

## 5. 五个必须知道的配置（10 分钟）

### tsconfig.json 的最小可用版

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",              // 编译到哪个 JS 版本
    "lib": ["ES2023", "DOM"],        // 我能用哪些内置 API
    "module": "NodeNext",            // Node 服务用 NodeNext，前端用 ESNext/Bundler
    "moduleResolution": "NodeNext",  // 怎么找模块
    "strict": true,                  // ★ 永远开
    "noUncheckedIndexedAccess": true,// ★ 强烈推荐
    "noImplicitOverride": true,
    "skipLibCheck": true,            // 大型项目几乎都开（跳过 .d.ts 检查，快很多）
    "noEmit": true                   // 只做类型检查，产物交给 Vite/esbuild
  },
  "include": ["src/**/*.ts"]
}
```

### 三个关键点

**① `strict: true` 是一个总开关，核心是 `strictNullChecks`**

它让 `null` / `undefined` 不能悄悄流进任何变量。
这是 TS 最值钱的功能，**新项目永远开，老项目也要列进技术债清单**。

**② `noUncheckedIndexedAccess: true` 是"防崩溃神器"**

```ts
const arr = [1, 2, 3];
const x = arr[10];
// 不开：x 是 number（骗你的，运行时是 undefined）
// 开了：x 是 number | undefined（诚实）
```

**代价**：所有 `arr[i]` 和 `record[key]` 都要处理 `undefined`，代码会啰嗦一点。
**但这是真实世界的真相**，建议新项目直接开。

**③ Vite / esbuild 不做类型检查**

它们只把类型语法**删掉**，完全不理解类型对不对。
所以 **`npm run dev` 没报错 ≠ 类型是对的**。

CI 里必须单独跑：

```json
{
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && vite build"
  }
}
```

> → 深入：第 08 章《工程化与 tsconfig》

---

## 6. 十二个必踩的坑（15 分钟）

| # | 坑 | 现象 | 修法 |
|---|---|---|---|
| 1 | 用 `\|\|` 设默认值 | `0` 和 `''` 被吃掉 | 用 `??` |
| 2 | 用 `if (x)` 判空字符串 | `''` 被当成"没有值" | 用 `x != null` |
| 3 | `typeof null === 'object'` | 判对象时漏了 null | `typeof x === 'object' && x !== null` |
| 4 | 空数组推断成 `any[]` | 塞什么进去都不报错 | `const a: T[] = []` |
| 5 | `Object.keys()` 返回 `string[]` | 用它索引对象报 TS7053 | 自己包一个 `typedKeys<T>` |
| 6 | `JSON.parse` 返回 `any` | 外部数据完全不受保护 | 标 `unknown`，用 zod 校验 |
| 7 | `switch` 漏了分支 | 静默返回 `undefined` | `default: assertNever(x)` |
| 8 | 判别属性写成 `string` | 收窄完全失效 | 改成字面量联合 `'a' \| 'b'` |
| 9 | 闭包里收窄失效 | TS18047 possibly null | 进闭包前存成 `const` |
| 10 | 类型谓词写漏了检查 | 编译过，运行时炸 | 逐项核对目标类型 |
| 11 | `as` 骗编译器 | 编译过，运行时炸 | 边界处做运行时校验 |
| 12 | `enum` 在 Node 直跑报错 | `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` | 用 `as const` 对象替代 |

### 第 12 条展开（现代 TS 的推荐做法）

```ts
// ❌ enum：不是"可擦除语法"，Node 原生跑 TS 会报错
enum Status { Idle, Loading, Done }

// ✅ 用 as const 对象替代
const Status = {
  Idle: 'idle',
  Loading: 'loading',
  Done: 'done',
} as const;
type Status = (typeof Status)[keyof typeof Status];
//   ^? "idle" | "loading" | "done"
```

**好处**：可擦除、可摇树、值就是字面量（存进数据库/发接口不会被转成数字）、和判别联合天然兼容。

### 报错速查（最常见的 10 个）

| 错误码 | 人话 | 修法 |
|---|---|---|
| **TS2322** | 类型 A 不能赋给类型 B | 看错误最后一行，那才是最具体的原因 |
| **TS2339** | 这个类型上没有这个属性 | 是不是联合类型没收窄？或拼错了 |
| **TS2345** | 参数类型不对 | 看提示的期望类型 |
| **TS2531/2532** | 对象可能为 null / undefined | 加判空，或用 `?.` / `??` |
| **TS7006** | 参数隐式 any | 补上参数类型 |
| **TS18046** | 这是 unknown 类型 | 先收窄（`typeof` / `in` / 类型谓词） |
| **TS18048** | 这个值可能是 undefined | 用 `??` 或先判空 |
| **TS2741** | 缺了必需的属性 | 补上，或改成可选 |
| **TS7053** | 不能用 string 索引这个类型 | 用 `keyof T` 约束，或包一个 typedKeys |
| **TS2589** | 类型实例化过深 | 类型体操写太复杂了，拆开 |

---

## 7. 一页速查表（5 分钟）

### 类型操作符

| 写法 | 作用 |
|---|---|
| `A \| B` | 联合："或" |
| `A & B` | 交叉："且" |
| `keyof T` | T 的所有键名组成的联合 |
| `typeof x` | 把值 x 变成类型（类型位置） |
| `T[K]` | 索引访问：T 中键 K 对应的类型 |
| `T[number]` | 数组/元组的元素类型 |
| `X extends Y ? A : B` | 条件类型（类型层面的 if） |
| `infer U` | 在条件类型里就地取出一个类型 |
| `T extends U` | 泛型约束："必须能赋值给 U" |
| `value is T` | 类型谓词（自定义收窄） |
| `asserts value is T` | 断言函数 |
| `as T` | 类型断言（骗编译器，运行时无操作） |
| `as const` | 锁成最窄的字面量类型 + readonly |
| `satisfies T` | 做检查但**保留**推断结果 |

### 修饰符

| 写法 | 含义 |
|---|---|
| `prop?: T` | 可选（= `T \| undefined`） |
| `readonly prop: T` | 只读（浅层） |
| `-?` | 在映射类型里**去掉**可选 |
| `-readonly` | 在映射类型里**去掉**只读 |
| `public` / `private` / `protected` | 可见性（都是编译期的，运行时不拦） |
| `#field` | JS 原生真私有（运行时也拦） |
| `abstract` / `override` / `static` | 抽象 / 重写 / 静态 |

### 心智模型速记

```
06 类型 = 编译期的图纸，运行时不存在
   ├─ 所以：不能 instanceof interface、不能 new T()
   └─ 所以：类型不影响性能；外部数据不受保护

两个世界：类型空间（interface / type / T） vs 值空间（const / class / function）
   └─ 报错看不懂时，先问"我在哪个世界"

结构化：看形状不看名字
   └─ 例外：private / protected 会引入名义性

不健全：宁可放过，不愿挡住
   └─ 证据：any、as、数组协变、Object.keys 返回 string[]
   └─ 结论：类型是意图说明 + 第一道防线，不是安全保证
```

### 写代码时的默认选择

| 场景 | 默认选择 |
|---|---|
| 多种业务状态 | **判别联合** |
| 可能失败的操作用 | **`Result<T, E>`**（或明确抛错的边界） |
| 外部数据入口 | **`unknown`** + 运行时校验 |
| 复用逻辑又要保类型 | **泛型 `<T>`** |
| 默认值 | **`??`** |
| 联合类型的 `switch` | **`default: assertNever(x)`** |
| 对象配置常量 | **`as const`** 或 **`satisfies`** |
| 需要一个"什么都能装"的类型 | 先想想能不能用泛型 |

---

## 8. 自测 20 题（15 分钟）

先做题，答案在最后。

**判断对错（1~10）**

1. `let x = 1` 之后，`x` 的类型是字面量 `1`。
2. `interface` 编译后会变成一个真实的 JavaScript 对象。
3. `any` 能赋值给任何类型，任何类型也能赋值给 `any`。
4. `unknown` 类型的值可以直接写 `u.name`。
5. `never` 可以赋值给任何类型。
6. `String` 和 `string` 是同一个类型。
7. `readonly number[]` 在运行时真的不可修改。
8. `as` 会在运行时做真正的类型转换。
9. TypeScript 的 `private` 在运行时是真的私有。
10. `Object.keys({ a: 1 })` 的返回类型是 `'a'[]`。

**说出类型（11~15）**

```ts
11. const a = 1;
12. let b = 1;
13. const c = [1, 'x', true];
14. const d = JSON.parse('{}');
15. const e = [1, 2, 3][10];
```

**改错（16~20）**

```ts
// 16. 期望 getPageSize({ pageSize: 0 }) 返回 0
function getPageSize(input: { pageSize?: number }): number {
  return input.pageSize || 20;
}

// 17. 期望所有分支都被处理
type S = 'a' | 'b' | 'c';
function f(s: S): string {
  if (s === 'a') return 'A';
  if (s === 'b') return 'B';
}

// 18. 期望拼错字段名时编译报错
type User = { name: string; age: number };
const u: User = { name: 'T', age: 1 };
const tmp = { name: 'T', age: 1, nmae: 'typo' };
const u2: User = tmp;         // 为什么不报错？怎么改？

// 19. 期望 state.data 在 success 分支下确定存在
type State = { status: string; data?: string[] };
function pick(s: State) {
  if (s.status === 'success') return s.data.join(',');
}

// 20. 这个泛型有什么问题？
function log<T>(value: T): void { console.log(value); }
```

---

### 答案

| # | 答案 | 解析 |
|---|---|---|
| 1 | **错** | `let` 推断成 `number`。`const x = 1` 才是 `1` |
| 2 | **错** | 类型擦除，`interface` 编译后完全消失 |
| 3 | **对** | `any` 是双向黑洞，这正是它危险的原因 |
| 4 | **错** | 报 `TS18046`，必须先收窄 |
| 5 | **对** | `never` 是底层类型 |
| 6 | **错** | `String` 是包装对象，永远用小写 |
| 7 | **错** | 纯编译期约束，运行时照样能 push |
| 8 | **错** | `as` 只做编译期断言，运行时不生成任何代码 |
| 9 | **错** | `(obj as any).secret` 照样能读。JS 的 `#field` 才是真私有 |
| 10 | **错** | 是 `string[]`，TS 刻意的不精确 |
| 11 | `1` | `const` + 字面量 |
| 12 | `number` | `let` 会放宽 |
| 13 | `(string \| number \| boolean)[]` | 元素类型取联合 |
| 14 | **`any`** | ★ `JSON.parse` 的返回类型，外部数据不受保护 |
| 15 | **`number`** | ★ 不是 `number \| undefined`。想让它诚实，开 `noUncheckedIndexedAccess` |
| 16 | 用 `??` | `input.pageSize ?? 20` |
| 17 | 加 `assertNever` | `default`/末尾写 `return assertNever(s)`，并把返回类型写死为 `string` |
| 18 | **多余属性检查只对字面量生效** | 直接写 `const u2: User = { name, age, nmae }` 会报 TS2353；需要中间变量时用 `satisfies User` |
| 19 | **判别属性是 `string`，收窄失效** | 改成 `type State = { status: 'success'; data: string[] } \| { status: 'other' }` |
| 20 | **`T` 只出现一次** | 等价于 `unknown` 但更啰嗦，改成 `(value: unknown)` |

**评分：**

- 错 0~2 题 → 可以开始写 TS 代码了。
- 错 3~6 题 → 回头补对应的小节。
- 错 7 题以上 → 建议读完整版 `docs/` 的 04 章和 05 章。

---

## 下一步

1. **动手**：打开 `examples/`，把 `02`、`04`、`05` 三个文件跑一遍，每个都改一改。
2. **自测**：做 `docs/10-测试题与答案.md` 的第一、二关。
3. **实战**：跑 `examples/project/`（一个类型安全的任务管理器），然后自己重写一遍。
4. **深入**：按需要挑 `docs/` 里的章节读，重点是 **04（收窄）** 和 **06（类型体操）**。
5. **面试前**：看 `docs/11-面试速查表.md`。

> **最后一句：TypeScript 的难点从来不是语法，而是"什么时候该用什么建模"。**
> 这个能力只能靠在真实项目里反复做判断练出来。你现在已经有全部工具了。
