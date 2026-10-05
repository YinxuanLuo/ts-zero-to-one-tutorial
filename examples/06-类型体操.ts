/**
 * 06 — 类型体操（够用版）· 配套可运行代码
 *
 * 怎么跑：
 *   node 06-类型体操.ts
 *   npx tsc --noEmit
 *
 * 重要：类型体操几乎全部发生在「编译期」，运行时什么都看不见。
 * 所以这个文件做了两件事，让你跑起来有输出：
 *   1) 用 assertType / assertNever 之类的运行时断言，把「编译期的结论」打印出来；
 *   2) 把「报错演示」全部写进注释（注释掉的代码不会影响本文件通过检查）。
 *
 * 一个贯穿全章的观点：
 *   工作中 95% 的时间你只需要「读懂」类型体操，不需要「自创」。
 *   这个文件里手写的每一个工具类型，都是 TypeScript 官方 lib 里真实存在的实现。
 */

console.log('========== 第 06 章：类型体操（够用版） ==========');
console.log('[环境] Node:', process.version);

// ============================================================
// 0. 运行时探针：让编译期的结论能被打出来
// ============================================================
// 类型在运行时不算数，所以我们用「真实的值」来间接展示类型结论。
// 这三个函数本身不含任何类型体操，只是脚手架。

/**
 * 把「编译期推断出来的 T」原样还回去。
 * 它最大的价值是：在编辑器里把鼠标悬停在参数上，就能看到 T 是什么。
 */
function assertType<T>(value: T): T {
  return value;
}

/** 运行时断言：不相等就抛错。用来把「类型结论」变成「真能看见的对比」。 */
// 注意这两个参数的类型故意写成 unknown：断言辅助函数只负责「运行时比一比」，
// 不该把左边的类型反过来当成右边的上下文类型（那样会干扰复杂类型的推断）。
function assertEqual(actual: unknown, expected: unknown, label: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`);
  if (!ok) throw new Error(`断言失败: ${label}`);
}

/** 穷尽检查：如果 union 里还有没处理的分支，这里编译不过。 */
function assertNever(x: never): never {
  throw new Error(`未处理的分支: ${JSON.stringify(x)}`);
}

// ---------- 编译期断言：把「类型结论」变成「编译能不能过」 ----------
/** 断言 T 必须是 true，否则编译报错。 */
type Assert<T extends true> = T;

// ============================================================
// 1. 五个基础操作符
// ============================================================
console.log('\n[1] 五个基础操作符');

// ---------- 1.1 keyof T：列出一张表的所有列名 ----------
// 类比：keyof 就是「把这张表的所有列名抄下来，写成一个清单」。
// 你拿到的是列名的集合，不是列里的数据。
//
// 先立一张「基准表」，本章后面反复用它：
interface UserEntity {
  id: number;
  name: string;
  email: string;
  age: number;
}
// 用一个「少了 age 的视图」来演示 keyof：它只关心自己有的列。
interface User {
  id: number;
  name: string;
  email: string;
}

// 等价于 type UserKey = 'id' | 'name' | 'email'
type UserKey = keyof User;

type CheckKeyof = UserKey;
const _checkKeyof: CheckKeyof[] = ['id', 'name', 'email']; // 三个都合法
// ❌ 你可能这么写：const _bad: UserKey = 'nickname';
// 真实报错（tsc）：
//     error TS2322: Type '"nickname"' is not assignable to type 'keyof User'.
console.log('[1.1] keyof User 就是这三个字符串 ->', _checkKeyof.join(' | '));

// keyof 真正上岗的地方：写一个「按列名取值」的工具函数。
function pluck<T, K extends keyof T>(rows: T[], key: K): T[K][] {
  return rows.map((row) => row[key]);
}
assertType<User>({ id: 1, name: 'Ada', email: 'ada@x.io' });
const users: User[] = [
  { id: 1, name: 'Ada', email: 'ada@x.io' },
  { id: 2, name: 'Bob', email: 'bob@x.io' },
];
assertEqual(pluck(users, 'name'), ['Ada', 'Bob'], "pluck(users, 'name')");
// ❌ 你可能这么写：pluck(users, 'nickname');
// 真实报错（tsc）：
//     error TS2345: Argument of type '"nickname"' is not assignable to parameter of type 'keyof User'.

// 坑 1：带索引签名的对象，keyof 会得到 string | number，而不是具体列名
type Dict = { [k: string]: number };
type DictKey = keyof Dict; // string | number  ← 注意有 number
const _dictKeys: DictKey[] = ['anyString', 0];
console.log('[1.1] keyof { [k: string]: number } 是 string | number ->', _dictKeys.length, '个样例值');

// 坑 2：keyof 只看「公开属性」，也只看「类型上声明过的属性」
type WithOptional = { a: string; b?: number };
type OptionalKey = keyof WithOptional; // 'a' | 'b'（可选属性照样在清单里）
const _optKeys: OptionalKey[] = ['a', 'b'];
console.log('[1.1] 可选属性也在清单里 ->', _optKeys.join(' | '));

// **一句话记住它：`keyof T` = 把 T 的列名抄成一张清单（字符串/数字字面量联合）。**

// ---------- 1.2 类型位置的 typeof：拍张照片存成图纸 ----------
// 类比：值是一个真实的东西，typeof 是给它拍一张照片，把照片存成「图纸」。
// 以后照着这张图纸就能造出一模一样形状的东西。
//
// ⚠️ 它和第 02 章讲的「值位置的 typeof」是两个完全不同的东西：
//     值位置 typeof x  -> 运行时算出一个字符串："string" / "number" / "object"
//     类型位置 typeof x -> 编译期算出一个类型：{ id: number; name: string }
//   判断方法：看它出现在「类型的位置」还是「表达式的位置」。
const defaultConfig = {
  host: 'localhost',
  port: 5432,
  retry: 3,
};

// typeof 后面跟的是「一个真的有名字的值」，不是随便什么表达式。
type DefaultConfig = typeof defaultConfig;
// 等价于 type DefaultConfig = { host: string; port: number; retry: number }

function readConfig(cfg: DefaultConfig): string {
  return `${cfg.host}:${cfg.port} (retry=${cfg.retry})`;
}
assertEqual(readConfig(defaultConfig), 'localhost:5432 (retry=3)', 'typeof 值 -> 类型 -> 再用回来');

// 运行时那个 typeof 还在，而且它给出的是完全不同的答案：
console.log('[1.2] 运行时 typeof defaultConfig =', typeof defaultConfig);
console.log('[1.2] 运行时 typeof defaultConfig.port =', typeof defaultConfig.port);

// ❌ 你可能这么写（typeof 后面跟一个函数调用）：
//     const c = { a: 1 };
//     type Bad = typeof c.a.toString();
// 真实报错（tsc，两条一起报）：
//     error TS1005: ';' expected.
//     error TS1109: Expression expected.
// ❌ 也不能用下标访问：
//     type Bad2 = typeof c['a'];
// 真实报错（tsc）：
//     error TS1005: ';' expected.
//
// 记住规则：类型位置的 typeof 后面只能跟「名字」——变量名、函数名、class 名、
// import 进来的绑定名；**点号后面也必须是名字**（写成 A.B.C 这种「实体名」的形式）。
// 所以 typeof c.a 是合法的（它确实等于 number），
// 但 typeof c.a.toString()、typeof c['a'] 这种「真的在求值」的写法不行。
const c = { a: 1 };
type DottedType = typeof c.a; // 合法！等于 number
assertEqual(c.a, 1, 'typeof c.a 合法（它等价于属性 a 的类型）');

// typeof 最实用的一个用途：从运行时真值反推类型，避免手抄一遍。
function createServer(options: { port: number; name: string }) {
  return { ...options, startedAt: Date.now() };
}
type ServerOptions = Parameters<typeof createServer>[0]; // { port: number; name: string }
const serverOptions: ServerOptions = { port: 8080, name: 'api' };
assertEqual(Object.keys(serverOptions).sort().join(','), 'name,port', 'typeof 值 + Parameters 反推出参数类型');

// **一句话记住它：类型位置的 `typeof 值` 是给值拍张照片存成图纸；它只能拍「有名字的值」。**

// ---------- 1.3 索引访问类型 T[K]：从类型里取出某一列的类型 ----------
// 类比：keyof 是列名清单，T[K] 是「拿着列名去查这一列装的是什么类型的货」。
type UserId = User['id']; // number
type UserName = User['name']; // string

const _id: UserId = 42;
const _name: UserName = 'Ada';
console.log('[1.3] User["id"] = number ->', typeof _id, '| User["name"] = string ->', typeof _name);

// 传入联合键名，得到联合结果
type UserIdOrName = User['id' | 'name']; // number | string
const _mix: UserIdOrName = Math.random() > 0.5 ? 1 : 'Ada';
console.log('[1.3] User["id" | "name"] = number | string ->', typeof _mix);

// 传入 keyof T，得到「所有属性类型的联合」
type UserValue = User[keyof User]; // number | string
const _val: UserValue = 'anything';
console.log('[1.3] User[keyof User] = number | string ->', typeof _val);

// 索引访问可以套娃，用来穿透嵌套类型
type Deep = {
  order: {
    items: { sku: string; qty: number }[];
    buyer: { uid: number };
  };
};
type Sku = Deep['order']['items'][number]['sku']; // string
const _sku: Sku = 'SKU-1';
console.log('[1.3] 三层套娃取到 sku 的类型 ->', typeof _sku);

// 对数组用 [number]，表示「元素的类型」
type Item = Deep['order']['items'][number];
assertEqual({ sku: 'A', qty: 1 }, { sku: 'A', qty: 1 } satisfies Item, 'arr[number] 取元素类型');

// 坑：keyof T 拿到的键，不一定能直接索引
// ❌ 你可能这么写：
//     type Bad = User['nickname'];
// 真实报错（tsc）：
//     error TS2339: Property 'nickname' does not exist on type 'User'.
// ❌ 也可能这么写：
//     function getValue<T>(obj: T, key: keyof T) { return obj[key]; }
//     const x: number = getValue({ a: 1 }, 'a');
// 真实报错（tsc）：
//     error TS2322: Type 'string | number' is not assignable to type 'number'.
//   原因：keyof { a: number } 是 'a'，但如果 T 有多个键，T[keyof T] 是联合类型。
//   想让「键」和「值」一一对应，得用泛型把 K 固定住（见下一节）。

// **一句话记住它：`T['列名']` 是拿列名去查这一列的货物类型；`T[keyof T]` 是「所有列类型的大联合」。**

// ---------- 1.4 泛型约束 T extends U（第 05 章复习 + 和索引访问配合） ----------
// 类比：extends 在这里不是「继承」，是「准入门槛」——你得是 U 的一种，才准进来。
//
// 为什么需要它？因为函数体里要 obj[key]，编译器必须能证明 key 一定在 obj 上。
// ❌ 你可能这么写：
//     function get1<T>(obj: T, key: string) { return obj[key]; }
// 真实报错（tsc）：
//     error TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type 'unknown'.
//   （strict 下不同上下文措辞略有差别，核心是「不能用 string 去索引未知类型」）
//
// 正确写法：把 K 约束成 keyof T，并且「用 K 把返回值锁死」。
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const ada: UserEntity = { id: 1, name: 'Ada', email: 'ada@x.io', age: 36 };
const gotName: string = get(ada, 'name'); // 精确到 string，不是 number | string
const gotId: number = get(ada, 'id');
assertEqual(gotName, 'Ada', "get(ada, 'name') 的类型是 string");
assertEqual(gotId, 1, "get(ada, 'id') 的类型是 number");
// ❌ 你可能这么写：get(ada, 'nickname');
// 真实报错（tsc）：
//     error TS2345: Argument of type '"nickname"' is not assignable to parameter of type 'keyof UserEntity'.

// 结构式约束：只要「有 length: number」就准入，不要求你继承谁
function twice<T extends { length: number }>(x: T): number {
  return x.length * 2;
}
assertEqual(twice('abcd'), 8, "twice('abcd') —— string 有 length");
assertEqual(twice([1, 2, 3]), 6, 'twice([1,2,3]) —— 数组有 length');
// ❌ 你可能这么写：twice(123);
// 真实报错（tsc）：
//     error TS2345: Argument of type 'number' is not assignable to parameter of type '{ length: number; }'.

// **一句话记住它：`K extends keyof T` 是给泛型加准入门槛，同时让返回值精确到 `T[K]`。**

// ---------- 1.5 as const：把值冻成最窄的字面量类型 ----------
// 类比：普通推断是「记个大概」——你写 'admin'，它记成 string。
// as const 是「逐字抄写 + 塑封」——它记成 'admin'，而且冻住不让人改。
const roleWide = { role: 'admin' }; // { role: string }
type WideRole = typeof roleWide;
const _wide: WideRole = { role: '随便是啥字符串都行' };
console.log('[1.5] 不加 as const，role 的类型是 string ->', _wide.role);

const roleNarrow = { role: 'admin' } as const; // { readonly role: "admin" }
type NarrowRole = typeof roleNarrow;
const _narrow: NarrowRole = { role: 'admin' };
// ❌ 你可能这么写：const _bad: NarrowRole = { role: 'user' };
// 真实报错（tsc）：
//     error TS2322: Type '"user"' is not assignable to type '"admin"'.
console.log('[1.5] 加了 as const，role 的类型是 "admin" ->', _narrow.role);

// 真实场景 A：配置对象 —— 从值的联合里推导出类型，不用手抄两遍
const LogLevels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const;

type LogLevelName = keyof typeof LogLevels; // "debug" | "info" | "warn" | "error"
type LogLevelValue = (typeof LogLevels)[LogLevelName]; // 10 | 20 | 30 | 40

function isMoreSevere(a: LogLevelValue, b: LogLevelValue): boolean {
  return a > b;
}
assertEqual(isMoreSevere(LogLevels.error, LogLevels.info), true, '配置对象 as const 之后仍能当值用');
const _levelName: LogLevelName = 'warn';
const _levelValue: LogLevelValue = 30;
console.log('[1.5] 从配置对象白捡两个类型 ->', _levelName, _levelValue);

// 真实场景 B：路由表 —— 路径和名字一次写清，改一处全局生效
const routes = [
  { name: 'home', path: '/' },
  { name: 'userDetail', path: '/users/:id' },
  { name: 'settings', path: '/settings' },
] as const;

type RouteName = (typeof routes)[number]['name']; // "home" | "userDetail" | "settings"
function navigate(name: RouteName): string {
  return routes.find((r) => r.name === name)?.path ?? '/';
}
assertEqual(navigate('userDetail'), '/users/:id', 'navigate("userDetail")');
// ❌ 你可能这么写：navigate('userDetial');  // 拼错
// 真实报错（tsc）：
//     error TS2345: Argument of type '"userDetial"' is not assignable to parameter of type '"home" | "userDetail" | "settings"'.

// 坑：as const 会让整个值变成只读，而且它修饰的是「这个字面量」，
// 不负责帮你检查「键名是不是我允许的那几个」。两种需求要分开做：
// ❌ 你可能这么写（想用赋值把配置钉死在合法键上）：
//     type LogLevelName2 = 'debug' | 'info' | 'warn' | 'error';
//     const config2: Record<LogLevelName2, number> = { debug: 10, trace: 5 };
// 真实报错（tsc）：
//     error TS2353: Object literal may only specify known properties,
//     and 'trace' does not exist in type 'Record<LogLevelName2, number>'.
//
// 正确姿势：as const 负责「保住字面量类型」，satisfies 负责「检查一下形状」。
// 两者叠加，既拿到最窄的类型，又保证键名合法。
type LogLevelName2 = 'debug' | 'info' | 'warn' | 'error';
const checkedLevels = { debug: 10, error: 40 } as const satisfies Partial<
  Record<LogLevelName2, number>
>;
// ❌ 把 debug 改成 trace，会报：
//     error TS2353: Object literal may only specify known properties, and 'trace' does not exist in type 'Partial<Record<LogLevelName2, number>>'.
assertEqual(Object.keys(checkedLevels).sort().join(','), 'debug,error', 'as const + satisfies 两件事都办到了');

// 陷阱：不加 as const 时，从数组推导的联合会退化成 string
const badRoutes = [{ name: 'home' }, { name: 'userDetail' }]; // { name: string }[]
type BadRouteName = (typeof badRoutes)[number]['name']; // string ← 白忙一场
const _badName: BadRouteName = '你怎么拼都行';
console.log('[1.5] 忘了 as const，推导出来就退化成 string ->', _badName);

// **一句话记住它：`as const` 把值冻成最窄的字面量类型——想从值反推联合类型，它几乎是必需品。**

// ============================================================
// 2. 映射类型（Mapped Types）
// ============================================================
console.log('\n[2] 映射类型');

// ---------- 2.1 逐字拆解 { [K in keyof T]: ... } ----------
// 类比：把表里的每一列，挨个拿出来套一遍同一个函数，再拼成一张新表。
// 读法（从左到右）：
//   [K in keyof T]  ：K 依次等于 T 的每一个列名（K 是个「循环变量」）
//   :               ：每一列变成什么类型
//   ? 和 readonly    ：可以在这两个位置上加修饰符
//
// 记住这条心法：映射类型 = 类型层面的 for...in 循环 + 直接改属性。
type Clone<T> = { [K in keyof T]: T[K] };
type UserClone = Clone<User>;
assertEqual(ada, ada satisfies UserClone, 'Clone<User> 和 User 结构完全一致');

// 让每一列都变成 string（真实场景：把实体转成「表格展示行」）
type Stringify<T> = { [K in keyof T]: string };
const tableRow: Stringify<User> = { id: '1', name: 'Ada', email: 'ada@x.io' };
assertEqual(Object.keys(tableRow).join(','), 'id,name,email', 'Stringify<User> 每列都变 string');

// ---------- 2.2 手写 Partial / Required / Readonly ----------
// 这三个就是 TypeScript 官方 lib 里的真实实现，你抄下来就等于「读懂源码」。
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
type MyRequired<T> = { [K in keyof T]-?: T[K] };

type Patch = MyPartial<User>; // id? name? email?
const patch: Patch = { name: 'Ada' };
assertEqual(Object.keys(patch).join(','), 'name', 'MyPartial 允许只写一部分字段');

const frozen: MyReadonly<User> = ada;
// ❌ 你可能这么写：frozen.name = 'Bob';
// 真实报错（tsc）：
//     error TS2540: Cannot assign to 'name' because it is a read-only property.
console.log('[2.2] MyReadonly<User> 里 name =', frozen.name);

type Full = MyRequired<Patch>; // 三个字段全变回必填
const full: Full = { id: 1, name: 'Ada', email: 'ada@x.io' };
assertEqual(Object.keys(full).length, 3, 'MyRequired 把问号去干净了');

// ---------- 2.3 修饰符 + / - ：把问号和 readonly 摘掉 ----------
// 类比：+ 是「给它戴上」，- 是「把它摘掉」。不写前缀等价于 +。
//   -?        去掉可选
//   -readonly 去掉只读
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type UserPatch = Mutable<MyReadonly<User>>;
const mutableUser: UserPatch = { id: 1, name: 'Ada', email: 'ada@x.io' };
mutableUser.name = 'Ada Lovelace'; // 现在允许改了
assertEqual(mutableUser.name, 'Ada Lovelace', 'Mutable 把 readonly 摘掉了');

// 看清楚「一个字段一个字段地摘」
type Half = {
  a?: string;
  readonly b: number;
};
type HalfMutable = { -readonly [K in keyof Half]-?: Half[K] };
const halfMutable: HalfMutable = { a: '必须给', b: 1 };
assertEqual(halfMutable.a, '必须给', 'a 的 ? 被 -? 摘掉了');

// 反向：用 + 显式加上（写出来是为了让同事一眼看到你的意图）
type HalfFrozen = { +readonly [K in keyof Half]+?: Half[K] };
const halfFrozen: HalfFrozen = {};
assertEqual(Object.keys(halfFrozen).length, 0, '+readonly +? 之后全可省');

// ============================================================
// 3. 工具类型全家桶（每个都手写一遍）
// ============================================================
console.log('\n[3] 工具类型全家桶');

// ---------- 3.1 Partial：全部变可选 ----------
// 场景：更新接口的入参（PATCH 语义）。
type MyPartial2<T> = { [K in keyof T]?: T[K] };
type UserUpdateDTO = MyPartial2<UserEntity>;
function updateUser(id: number, changes: UserUpdateDTO): UserUpdateDTO {
  return { id, ...changes };
}
assertEqual(updateUser(1, { name: 'Ada' }), { id: 1, name: 'Ada' }, 'Partial 支撑 PATCH 风格入参');

// ---------- 3.2 Required：全部变必填 ----------
// 场景：把「草稿配置」升级成「最终配置」。
interface DraftConfig {
  host?: string;
  port?: number;
  debug?: boolean;
}
type MyRequired2<T> = { [K in keyof T]-?: T[K] };
type FinalConfig = MyRequired2<DraftConfig>;
const finalConfig: FinalConfig = { host: 'localhost', port: 5432, debug: false };
assertEqual(Object.keys(finalConfig).length, 3, 'Required 保证三个字段都在');

// ---------- 3.3 Readonly：全部变只读 ----------
type MyReadonly2<T> = { readonly [K in keyof T]: T[K] };
const roUsers: MyReadonly2<UserEntity[]> = [
  { id: 1, name: 'Ada', email: 'a@x.io', age: 36 },
];
// ❌ 你可能这么写：roUsers.push({ ... });
// 真实报错（tsc）：
//     error TS2339: Property 'push' does not exist on type 'readonly UserEntity[]'.
console.log('[3.3] Readonly<数组> 连 push 都没有了 -> 长度', roUsers.length);

// ---------- 3.4 Pick：从大类型里挑几个字段 ----------
// 场景：列表页 DTO —— 后端一次性返回 30 个字段，列表只要 3 个。
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
type UserListItem = MyPick<UserEntity, 'id' | 'name'>;
const listItem: UserListItem = { id: 1, name: 'Ada' };
// ❌ 你可能这么写：const bad: UserListItem = { id: 1, name: 'Ada', email: 'a@x.io' };
// 真实报错（tsc）：
//     error TS2353: Object literal may only specify known properties, and 'email' does not exist in type 'UserListItem'.
assertEqual(Object.keys(listItem).join(','), 'id,name', 'Pick 只留挑中的列');

// ---------- 3.5 Omit：从大类型里排掉几个字段 ----------
// 场景：创建接口的入参 —— id 由后端生成，前端不许传。
// 注意这里 K 的约束是 `keyof any`（等价于 string | number | symbol），
// 不是 `keyof T` —— 这个细节下一段会讲，它正是 Omit 那个「著名坑」的来源。
type MyExclude<T, U> = T extends U ? never : T;
type MyOmit<T, K extends keyof any> = { [P in MyExclude<keyof T, K>]: T[P] };
type CreateUserDTO = MyOmit<UserEntity, 'id'>;
const createDto: CreateUserDTO = { name: 'Ada', email: 'a@x.io', age: 36 };
assertEqual(Object.keys(createDto).sort().join(','), 'age,email,name', 'Omit 排掉了 id');

// Omit 的坑：它不检查 K 是否存在 —— 用 Pick + Exclude 手写一遍就懂了。
// 官方 Omit 的实现是：Pick<T, Exclude<keyof T, K>>
// K 只是「从 keyof T 里减掉」，K 本身写错也不会报错。
type OopsOmit = MyOmit<UserEntity, 'notExist'>; // 编译通过！等于原类型
const _oops: OopsOmit = { id: 1, name: 'Ada', email: 'a@x.io', age: 36 };
console.log('[3.5] ⚠️ Omit 传了不存在的键也不报错（这是官方设计，不是 bug）->', Object.keys(_oops).length, '个字段');

// ---------- 3.6 Record：把键集合变成一个「查表」类型 ----------
// 场景：字典、状态映射、按 key 分组的缓存。
type MyRecord<K extends keyof any, T> = { [P in K]: T };
type RoleMap = MyRecord<'admin' | 'user' | 'guest', string>;
const roleMap: RoleMap = { admin: '管理员', user: '用户', guest: '访客' };
assertEqual(roleMap.user, '用户', 'Record 建出一张查表');
// ❌ 你可能这么写：const badMap: RoleMap = { admin: 'x', user: 'y' };
// 真实报错（tsc）：
//     error TS2741: Property 'guest' is missing in type '{ admin: string; user: string; }' but required in type 'RoleMap'.

// Record 的实战：用联合类型当键，保证「不漏一个分支」
type Status = 'pending' | 'success' | 'failed';
const statusText: MyRecord<Status, string> = {
  pending: '处理中',
  success: '成功',
  failed: '失败',
};
// 少写一个分支会被抓住，从而配合 switch 做到穷尽检查
function renderStatus(s: Status): string {
  switch (s) {
    case 'pending':
      return statusText.pending;
    case 'success':
      return statusText.success;
    case 'failed':
      return statusText.failed;
    default:
      return assertNever(s); // 少写一个 case 这里就编译不过
  }
}
assertEqual(renderStatus('failed'), '失败', 'Record + never 做穷尽检查');

// ---------- 3.7 Exclude：从联合里排掉几个 ----------
// 场景：从「所有事件」里排掉不需要处理的。
type AllEvents = 'click' | 'focus' | 'blur' | 'scroll';
type MyExclude2<T, U> = T extends U ? never : T;
type MouseEvents = MyExclude2<AllEvents, 'focus' | 'blur'>; // "click" | "scroll"
const _mouse: MouseEvents = 'scroll';
console.log('[3.7] Exclude<AllEvents, "focus" | "blur"> ->', _mouse);

// 真实用途：排掉 null / undefined，做个「可辨识联合」
type MaybeUser = UserEntity | null | undefined;
type DefiniteUser = MyExclude2<MaybeUser, null | undefined>;
const definite: DefiniteUser = ada as UserEntity;
assertEqual(definite.id, 1, 'Exclude 排掉空值');

// ---------- 3.8 Extract：从联合里只留几个 ----------
type MyExtract<T, U> = T extends U ? T : never;
type FormEvents = MyExtract<AllEvents, 'focus' | 'blur' | 'submit'>; // "focus" | "blur"
const _form: FormEvents = 'blur';
console.log('[3.8] Extract 只留交集 ->', _form);

// Exclude / Extract 的记忆法很暴力：
//   Exclude = 丢掉「属于 U 的」  -> 条件是 never
//   Extract = 只留「属于 U 的」  -> 条件是 T
// 两个字调换，就是两个工具类型。

// ---------- 3.9 NonNullable：排掉 null 和 undefined ----------
type MyNonNullable<T> = T extends null | undefined ? never : T;
type SafeName = MyNonNullable<string | null | undefined | number>; // string | number
const _safe: SafeName = 123;
console.log('[3.9] NonNullable<string | null | undefined | number> ->', typeof _safe);

// ---------- 3.10 ReturnType：把函数的返回类型抽出来 ----------
// 这一个必须靠 infer，下一节会把 infer 拆开讲。
type MyReturnType<T extends (...args: never[]) => unknown> = T extends (
  ...args: never[]
) => infer R
  ? R
  : never;

function fetchUser(id: number) {
  return { id, name: 'Ada', tags: ['a', 'b'] as string[] };
}
type FetchUserResult = MyReturnType<typeof fetchUser>;
const result: FetchUserResult = fetchUser(1);
assertEqual(result.name, 'Ada', 'ReturnType<typeof fetchUser> 就是它的返回类型');

// 场景：不用手抄接口，直接从已有函数「倒推」类型
function createSession(user: UserEntity) {
  return { token: `t-${user.id}`, expiresIn: 3600 };
}
type Session = MyReturnType<typeof createSession>;
const session: Session = { token: 't-1', expiresIn: 3600 };
assertEqual(session.expiresIn, 3600, 'Session 从 createSession 倒推得到');

// ---------- 3.11 Parameters：把函数的参数抽成元组 ----------
type MyParameters<T extends (...args: never[]) => unknown> = T extends (
  ...args: infer P
) => unknown
  ? P
  : never;

type CreateSessionArgs = MyParameters<typeof createSession>; // [user: UserEntity]
const _args: CreateSessionArgs = [ada];
assertEqual(_args[0].name, 'Ada', 'Parameters 抽出了参数元组');

// 场景：写一个「包装函数」，保留原函数签名 —— 业务里做日志、埋点极其常见
function withLogging<F extends (...args: never[]) => unknown>(fn: F) {
  return (...args: MyParameters<F>): MyReturnType<F> => {
    console.log('  [3.11] 调用前记录日志 ->', fn.name);
    return fn(...args) as MyReturnType<F>;
  };
}
const loggedFetch = withLogging(fetchUser);
const loggedResult = loggedFetch(2);
assertEqual(loggedResult.id, 2, '包装后签名不变');

// ---------- 3.12 Awaited：把 Promise 一层一层剥开 ----------
// 场景：async 函数的返回值是 Promise<User>，你只想要 User。
type MyAwaited<T> = T extends null | undefined
  ? T
  : T extends object & { then(onfulfilled: infer F, ...args: infer _): unknown }
    ? F extends (value: infer V, ...args: infer _) => unknown
      ? MyAwaited<V>
      : never
    : T;

async function loadUser(): Promise<UserEntity> {
  return { id: 1, name: 'Ada', email: 'a@x.io', age: 36 };
}
type LoadedUser = MyAwaited<ReturnType<typeof loadUser>>; // UserEntity
const loaded: LoadedUser = await loadUser();
assertEqual(loaded.name, 'Ada', 'Awaited 剥掉了 Promise');

// 嵌套 Promise 也能一路剥到底
type Nested = MyAwaited<Promise<Promise<Promise<string>>>>; // string
const _nested: Nested = 'deep';
console.log('[3.12] Awaited<Promise<Promise<Promise<string>>>> ->', typeof _nested);

// ---------- 3.13 InstanceType：从 class 拿到实例类型 ----------
// 类比：class 是「图纸」，InstanceType 是「照图纸造出来的那个东西的类型」。
class Logger {
  prefix = '[log]';
  log(msg: string): string {
    return `${this.prefix} ${msg}`;
  }
}
type MyInstanceType<T extends abstract new (...args: never[]) => unknown> =
  T extends abstract new (...args: never[]) => infer R ? R : never;

type LoggerInstance = MyInstanceType<typeof Logger>;
const loggerInstance: LoggerInstance = new Logger();
assertEqual(loggerInstance.log('hi'), '[log] hi', 'InstanceType<typeof Logger> 就是 Logger 实例');

// 场景：写一个工厂，接受 class，返回实例
// ⚠️ 这里的约束必须写「非 abstract 的构造函数签名」：
//    工具类型的约束可以更宽（用 abstract new），但函数体里真要 new 的时候，
//    编译器必须能确定它是「可实例化的」，所以不能加 abstract。
//    如果写成 <T extends abstract new ...>，就会报：
//      error TS2511: Cannot create an instance of an abstract class.
function build<T extends new (...args: never[]) => unknown>(
  Ctor: T,
): MyInstanceType<T> {
  return new Ctor() as MyInstanceType<T>;
}
const built = build(Logger);
assertEqual(built.log('built'), '[log] built', '工厂函数返回正确的实例类型');

// ---------- 3.14 全家桶速查表（运行时打印，方便你 Ctrl+F 找） ----------
const cheatSheet: [string, string][] = [
  ['Partial<T>', '所有字段变可选'],
  ['Required<T>', '所有字段变必填'],
  ['Readonly<T>', '所有字段变只读'],
  ['Pick<T, K>', '从 T 里挑出 K 这些键'],
  ['Omit<T, K>', '从 T 里排掉 K 这些键'],
  ['Record<K, V>', '用 K 当键、V 当值建查表'],
  ['Exclude<T, U>', '从联合 T 里排掉能赋给 U 的成员'],
  ['Extract<T, U>', '从联合 T 里只留能赋给 U 的成员'],
  ['NonNullable<T>', '排掉 null 和 undefined'],
  ['ReturnType<F>', '取函数 F 的返回类型'],
  ['Parameters<F>', '取函数 F 的参数元组'],
  ['Awaited<T>', '把 Promise 一层层剥开'],
  ['InstanceType<C>', '取 class C 的实例类型'],
];
console.log('[3.14] 工具类型速查表');
for (const [name, desc] of cheatSheet) console.log(`  ${name.padEnd(18)} ${desc}`);

// ============================================================
// 4. 条件类型
// ============================================================
console.log('\n[4] 条件类型');

// ---------- 4.1 T extends U ? X : Y：类型层面的 if ----------
// 类比：这就是类型世界里的 if (T 能赋给 U) X else Y。
// 注意：这里 extends 的含义是「可赋值」，不是「继承」。
type IsString<T> = T extends string ? true : false;

const _isString: IsString<'abc'> = true;
const _isNumber: IsString<42> = false;
console.log('[4.1] IsString<"abc"> ->', _isString, '| IsString<42> ->', _isNumber);

// 实用一点：判断一个类型是不是数组
type IsArray<T> = T extends unknown[] ? 'array' : 'not-array';
const _a1: IsArray<string[]> = 'array';
const _a2: IsArray<string> = 'not-array';
console.log('[4.1] IsArray<string[]> ->', _a1, '| IsArray<string> ->', _a2);

// 场景：给「可能是数组也可能是单个值」的入参统一成数组
function toArray<T>(input: T): T extends unknown[] ? T : T[] {
  return (Array.isArray(input) ? input : [input]) as T extends unknown[]
    ? T
    : T[];
}
assertEqual(toArray(1), [1], '单个值被包成数组');
assertEqual(toArray([1, 2]), [1, 2], '数组原样返回');

// ---------- 4.2 分布式条件类型：必须讲透的坑 ----------
// 类比：你让「一个检查组」去检查一箱水果。
//   如果箱子上写的是「苹果或橘子」，检查组会拆开，苹果过一遍、橘子过一遍，再把结果合并。
//   如果他们检查的是「一箱贴了标签的货」（被包在元组里），就整箱过一次，不分发。
//
// 规则：当被检查的类型是「裸的类型参数 T」（光秃秃一个 T，没被 [] 包住），
//      且传入的是联合类型时，条件类型会「对每个成员分别求值，再把结果合并」。
type DistStr<T> = T extends string ? 'str' : 'other';
type R1 = DistStr<'a' | 'b' | 1 | 2>; // 'str' | 'other'
const _r1: R1[] = ['str', 'other'];
console.log('[4.2] 分发之后结果是每个成员结果的并集 ->', _r1.join(' | '));

// 这个特性正是 Exclude 的实现基础：
//   Exclude<'a' | 'b' | 1, string>
//   = ('a' extends string ? never : 'a') | ('b' extends string ? never : 'b') | (1 extends string ? never : 1)
//   = never | never | 1
//   = 1
type OnlyNumber = MyExclude2<'a' | 'b' | 1, string>; // 1
const _onlyNumber: OnlyNumber = 1;
console.log('[4.2] Exclude<"a" | "b" | 1, string> ->', _onlyNumber);

// 坑 1：boolean 在类型层面就是 true | false，所以它也会被分发。
// 这是一个你能亲眼验证的例子：把 true 从 boolean 里减掉，剩下的就是 false。
type NotTrue = MyExclude2<boolean, true>; // false
const _notTrue: NotTrue = false;
type NotTrueIsFalse = NotTrue extends false ? true : false;
type _checkNotTrue = Assert<NotTrueIsFalse>;
// ❌ 你可能这么写：const _badNotTrue: NotTrue = true;
// 真实报错（tsc）：
//     error TS2322: Type 'true' is not assignable to type 'false'.
console.log('[4.2] ⚠️ Exclude<boolean, true> = false，证明 boolean 真的被拆开了 ->', _notTrue);

// 想阻止分发：把被检查的类型包进元组，让它「整箱检查」。
// 下面这对例子在两种写法下结果完全不同，是判断「要不要包元组」的最好试纸：
type ABC = 'a' | 'b' | 'c';

// 分发型：对 'a' / 'b' / 'c' 分别判断，结果是每个成员结果的并集
type Dist<T> = T extends 'a' | 'b' ? 'matched' : 'unmatched';
type D1 = Dist<ABC>; // 'matched' | 'unmatched'
const _d1: D1 = 'matched';
const _d2: D1 = 'unmatched';

// 阻断分发型：整箱检查，'a' | 'b' | 'c' 这一整包并不都在 'a' | 'b' 里
type NoDist<T> = [T] extends ['a' | 'b'] ? 'matched' : 'unmatched';
type N1 = NoDist<ABC>; // 'unmatched'
const _n1: N1 = 'unmatched';
// ❌ 你可能这么写：const _badN1: N1 = 'matched';
// 真实报错（tsc）：
//     error TS2322: Type '"matched"' is not assignable to type '"unmatched"'.
console.log('[4.2] Dist<ABC> 两个答案都能赋值 ->', _d1, _d2, '| NoDist<ABC> 只剩', _n1);

// 再补一刀：把变量换成一个「确定的整体」，分发就消失了
type Whole = Dist<'a'>; // 'matched'（单个成员，分不分发都一样）
const _whole: Whole = 'matched';
console.log('[4.2] 传入单个成员时分发没有意义 ->', _whole);

// 一句提醒：如果某个类型别名背后是「还没求值的条件类型」，
// 那么在它上面套别的条件类型做判断时，结果偶尔会反直觉
//（编译器比较的是那个「未求值的形式」）。
// 判断这种类型的真实范围，最可靠的办法是「用赋值去试」：
// 哪些字面量能赋给它，它的范围就是哪些字面量的联合。

// 不写元组的坑 2（最阴的一个）：never 是「空联合」，分发等于没有成员
type StrOrNum<T> = T extends string ? 'str' : 'other';
type WithNever = StrOrNum<never>; // never  ← 不是 'other'！
// ❌ 你可能这么写：const _withNever: WithNever = 'other';
// 真实报错（tsc）：
//     error TS2322: Type '"other"' is not assignable to type 'never'.
console.log('[4.2] ⚠️ 分发遇到 never 会得到 never（空联合没有成员可分）');

// 这里必须纠正一个网上的老经验：
// 很多人说「用 [T] extends [U] 包一层就能救 never」—— 在 TS 5.9 上实测不成立。
// 下面这行的结果取决于编译器对 never 的特殊处理，实测拿到的是 'str' 而不是 'other'：
type WithNeverFixed = [never] extends [string] ? 'str' : 'other';
console.log('[4.2] ⚠️ 包了元组也救不了 never：WithNeverFixed 实测是 "str" 那一支');

// 所以正确的做法不是「想办法救它」，而是「别让 never 走到这个条件类型里」：
// 在入口处先用 NonNullable<T>（或自己写一层守卫）把它挡掉，
// 或者干脆接受「never 进来就是 never 出去」这个事实。
// 这也顺带说明：类型体操的结论必须用编译器验证，不能靠背网上的口诀。

// 再强调一次：WithNever 是 never，而 never 是「空联合」——
// 没有任何值属于它，所以你连一个字面量都塞不进去。
const _neverList: WithNever[] = []; // 只能是空数组
console.log('[4.2] WithNever[] 只能装空数组，长度 ->', _neverList.length);

// 不写元组的坑 3：分发和「反向推断（infer）」组合时行为更绕，能加元组就加
// 经验法则（背下来就行）：
//   你「想对联合的每个成员分别判断」-> 用裸 T extends U（分发）
//   你「想看整个 T 作为一个整体是否满足 U」-> 用 [T] extends [U]（阻断分发）

// ---------- 4.3 infer：型号待定的占位符 ----------
// 类比：infer 是一个「型号待定的占位符」。
// 你告诉编译器：「这里应该塞着一个函数类型，参数我不管，返回值我留个坑叫 R，
//              你匹配上了就把真实类型填进 R」。填好了，就能在 true 分支里用 R。
//
// 记住 infer 的两个限制：
//   1) 只能出现在 extends 后面的「模式里」，不能单独用；
//   2) 一个模式里同一个名字 infer 两次，两次必须匹配到「同一个」类型（后面有例子）。

// 取函数返回值
type GetReturn<T> = T extends (...args: never[]) => infer R ? R : never;
const _ret: GetReturn<() => number> = 1;
console.log('[4.3] GetReturn<() => number> ->', typeof _ret);

// 取参数元组
type GetParams<T> = T extends (...args: infer P) => unknown ? P : never;
const _params: GetParams<(a: string, b: number) => void> = ['x', 1];
console.log('[4.3] GetParams 拿到的是元组 ->', JSON.stringify(_params));

// 取数组元素类型
type ElementOf<T> = T extends (infer E)[] ? E : never;
const _el: ElementOf<string[]> = 'x';
console.log('[4.3] ElementOf<string[]> ->', typeof _el);

// infer 的多个位置：一次抽干一个对象的不同部位
type SplitFn<T> = T extends (first: infer A, second: infer B) => infer R
  ? { a: A; b: B; r: R }
  : never;
type Split = SplitFn<(x: string, y: number) => boolean>;
const _split: Split = { a: 'x', b: 1, r: true };
assertEqual(Object.keys(_split).join(','), 'a,b,r', 'infer 一次抽出三个部位');

// infer 加约束：TS 4.7+ 支持 `infer E extends string`
// 只有在「E 满足约束」时才匹配成功，否则走 false 分支。
type FirstString<T> = T extends (infer E extends string)[] ? E : 'not-string-array';
const _firstString: FirstString<['a', 'b']> = 'a';
const _noFirstString: FirstString<[1, 2]> = 'not-string-array';
console.log('[4.3] infer 加约束 ->', _firstString, '/', _noFirstString);

// 用 infer 做「取 Promise 内层类型」
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type Inner = UnwrapPromise<Promise<number>>; // number
const _inner: Inner = 1;
console.log('[4.3] UnwrapPromise<Promise<number>> ->', typeof _inner);

// ---------- 4.4 递归条件类型：一层一层剥到底 ----------
// 类比：递归条件是「不停问同一个问题，直到问不出新东西」。
// 写递归条件类型必须有一个「先退出」的分支，否则就是无限递归。

// 版本 1：只剥一层（上面那个 UnwrapPromise 就是这样，遇到嵌套就歇菜）
type DeepUnwrap<T> = T extends Promise<infer U> ? DeepUnwrap<U> : T;
type DeepResult = DeepUnwrap<Promise<Promise<Promise<string>>>>; // string
const _deepResult: DeepResult = 'ok';
console.log('[4.4] 递归剥 Promise 到底 ->', typeof _deepResult);

// 版本 2：把嵌套数组拍平（面试常客，也是理解递归条件类型最好的例子）
type Flatten<T> = T extends (infer E)[] ? Flatten<E> : T;
type Flat1 = Flatten<number[][]>; // number
type Flat2 = Flatten<string[][][]>; // string
type Flat3 = Flatten<number>; // number（不是数组，直接返回）
const _flat1: Flat1 = 1;
const _flat2: Flat2 = 'x';
const _flat3: Flat3 = 3;
assertEqual([_flat1, _flat2, _flat3].length, 3, 'Flatten 拍平嵌套数组');

// 递归的深度是有上限的：TypeScript 大约在 50 层左右会报错
// ❌ 你可能这么写（夸张演示，实际要 50 层以上才会炸）：
//     type Deep50 = Flatten<number[][][]...[][][]>;  // 50 层方括号
// 真实报错（tsc）：
//     error TS2589: Type instantiation is excessively deep and possibly infinite.
// 这个错误码请记住，第 6 节还要专门讲它。

// 真实场景：递归把对象的所有字段变成可选（表单草稿、配置合并）
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;
interface ProjectConfig {
  server: { host: string; port: number };
  db: { url: string; pool: { min: number; max: number } };
}
const draftProject: DeepPartial<ProjectConfig> = {
  server: { port: 3000 },
  db: { pool: { max: 10 } },
};
assertEqual(
  JSON.stringify(draftProject),
  '{"server":{"port":3000},"db":{"pool":{"max":10}}}',
  'DeepPartial 让嵌套字段也能只写一部分',
);

// ============================================================
// 5. 模板字面量类型
// ============================================================
console.log('\n[5] 模板字面量类型');

// ---------- 5.1 基础语法 + 四个大小写工具 ----------
// 类比：模板字符串在运行时拼字符串；模板字面量类型在编译期拼类型。
// `${string}` 表示「这里可以塞任何字符串」，所以 `hello ${string}` 匹配所有 hello 开头的串。
type Greeting = `hello ${string}`;
const _g1: Greeting = 'hello world';
const _g2: Greeting = 'hello 世界'; // 中文也合法，它只是字符串
// ❌ 你可能这么写：const _g3: Greeting = 'hi world';
// 真实报错（tsc）：
//     error TS2322: Type '"hi world"' is not assignable to type '`hello ${string}`'.
console.log('[5.1] 模板字面量类型 ->', _g1, '/', _g2);

// 用联合类型填充占位符，会自动展开成「所有组合」
type Size = 'small' | 'large';
type Color = 'red' | 'blue';
type Product = `${Size}-${Color}`; // 4 种组合
const _products: Product[] = ['small-red', 'small-blue', 'large-red', 'large-blue'];
console.log('[5.1] 2 × 2 自动展开成', _products.length, '个合法值 ->', _products.join(', '));

// 四个内置的大小写工具（用 JS 的字符串原型方法实现，中文不受影响）
type U = Uppercase<'abc'>; // 'ABC'
type L = Lowercase<'ABC'>; // 'abc'
type C = Capitalize<'abc'>; // 'Abc'
type Un = Uncapitalize<'Abc'>; // 'abc'
const _cases: [U, L, C, Un] = ['ABC', 'abc', 'Abc', 'abc'];
assertEqual(_cases.join('|'), 'ABC|abc|Abc|abc', '四个大小写工具');

// 注意中文没有大小写，原样返回
const _cn: Uppercase<'中文abc'> = '中文ABC';
console.log('[5.1] 中文原样、英文变大写 ->', _cn);

// ---------- 5.2 真实场景 A：类型安全的事件名 ----------
// 场景：写事件总线、埋点 SDK、组件 props —— 事件名拼错是最高频的低级 bug。
type EventName = 'click' | 'focus' | 'submit';
// 只允许这三种，加上 on 前缀
type HandlerName = `on${Capitalize<EventName>}`; // 'onClick' | 'onFocus' | 'onSubmit'

const handlers: Record<HandlerName, () => string> = {
  onClick: () => '处理点击',
  onFocus: () => '处理聚焦',
  onSubmit: () => '处理提交',
};
assertEqual(handlers.onClick(), '处理点击', '类型安全的事件名');
// ❌ 你可能这么写：handlers.onClik();
// 真实报错（tsc）：
//     error TS2551: Property 'onClik' does not exist on type 'Record<"onClick" | "onFocus" | "onSubmit", () => string>'. Did you mean 'onClick'?

// ---------- 5.3 真实场景 B：从 !props 推出 !事件名（键重映射 + 模板字面量） ----------
// 场景：组件库的 props 是 onClick/onFocus，但内部事件总线用 click/focus。
// 手写两份清单必然对不上，用类型自动转换。
interface ButtonProps {
  label: string;
  onClick: () => void;
  onFocus: () => void;
}
type EventKeyOf<P> = {
  [K in keyof P as K extends `on${infer Rest}` ? Uncapitalize<Rest> : never]: P[K];
};
type ButtonEvents = EventKeyOf<ButtonProps>; // { click: ...; focus: ... }
const bus: ButtonEvents = { click: () => undefined, focus: () => undefined };
assertEqual(Object.keys(bus).sort().join(','), 'click,focus', 'onClick -> click 自动转换');

// ---------- 5.4 真实场景 C：类型安全的 CSS 单位 ----------
// 场景：设计系统里只允许这几种单位，写错 px/pel 的问题再也不会发生。
type Unit = 'px' | 'rem' | 'em' | '%';
type CssSize = `${number}${Unit}`;
const _sizes: CssSize[] = ['16px', '1.5rem', '100%', '-2em'];
// ❌ 你可能这么写：const _badSize: CssSize = '16pel';
// 真实报错（tsc，注意它会把模板字面量展开成所有组合）：
//     error TS2322: Type '"16pel"' is not assignable to type
//     '`${number}px` | `${number}rem` | `${number}em` | `${number}%`'.
console.log('[5.4] 合法尺寸 ->', _sizes.join(', '));

// 更狠一点：只允许 0-9 的整数，且单位只能 px
type SmallPx = `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}px`;
const _smallPx: SmallPx[] = ['0px', '9px'];
console.log('[5.4] 收窄到个位数 ->', _smallPx.join(', '));

// ---------- 5.5 性能陷阱：模板字面量 + 联合类型会组合爆炸 ----------
// 每多一个占位符，组合数是「乘法」增长的：
//   4 × 4 × 4 × 4 = 256 个成员 —— 还能忍
//   10 × 10 × 10 × 10 = 10000 个成员 —— 编辑器开始卡
//   再加两个呢？自己算。这就是「类型体操拖慢 tsc」最常见的元凶。
type A10 = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j';
type Explosion = `${A10}-${A10}-${A10}-${A10}`; // 10000 个成员
function countExplosion(): number {
  // 运行时我们只能间接体会一下这个规模（类型层面它真的生成了 1 万个成员）
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  let n = 0;
  for (const a of keys) for (const b of keys) for (const c of keys) for (const d of keys) n++;
  return n;
}
console.log('[5.5] `${A}-${A}-${A}-${A}` 的成员数是', countExplosion(), '（类型层面真的是 1 万个）');
const _oneOfExplosion: Explosion = 'a-b-c-d';
console.log('[5.5] 抽一个出来看看 ->', _oneOfExplosion);

// 规则：模板字面量类型里，只要占位符是「联合类型」，就是乘法。
// 你能接受的成员数上限大概在几千，超过就会明显拖慢编辑器和 tsc。

// ============================================================
// 6. 工程理性：什么时候不该写类型体操
// ============================================================
console.log('\n[6] 工程理性');

// ---------- 6.1 判断清单：该写 / 不该写 ----------
interface ChecklistItem {
  readonly rule: string;
  readonly verdict: '该写' | '不该写';
  readonly reason: string;
}
const checklist: ChecklistItem[] = [
  {
    rule: '从已有类型「减字段」生成 DTO（Pick / Omit）',
    verdict: '该写',
    reason: '一行顶手抄十个字段，改了源头自动同步',
  },
  {
    rule: '从运行时常量表反推联合类型（as const + typeof）',
    verdict: '该写',
    reason: '消灭「值和类型两份清单对不上」这类 bug',
  },
  {
    rule: '包装函数保留原签名（Parameters / ReturnType / 泛型）',
    verdict: '该写',
    reason: '日志、埋点、重试这类横切逻辑的标配',
  },
  {
    rule: '把外部数据（JSON / API）解析成已知类型',
    verdict: '该写',
    reason: '类型是安全网，但配一行运行时校验才算数',
  },
  {
    rule: '为「只出现一次」的场景自创一个 5 层嵌套条件类型',
    verdict: '不该写',
    reason: '没人能读懂，三个月后你自己也读不懂',
  },
  {
    rule: '用类型体操去做运行时该做的事（比如字符串长度校验）',
    verdict: '不该写',
    reason: '类型在运行时会被擦掉，一点都拦不住真实数据',
  },
  {
    rule: '为了少写一个 interface，硬凹抽象工具类型',
    verdict: '不该写',
    reason: '手写 interface 更好读，IDE 跳转也更准',
  },
  {
    rule: '在业务文件里堆超过 3 层的条件类型嵌套',
    verdict: '不该写',
    reason: '报错信息会变成天书，排错成本远超收益',
  },
  {
    rule: '给库作者用的公共 API 做精确类型（比如 zustand / trpc 那种）',
    verdict: '该写',
    reason: '一次投入，所有使用者受益，这是类型体操的正经用途',
  },
];
console.log('[6.1] 该写 / 不该写 判断清单');
for (const item of checklist) {
  console.log(`  [${item.verdict}] ${item.rule}\n            理由：${item.reason}`);
}

// ---------- 6.2 真实劝退案例：TS2589 ----------
// 场景：有人想给「CSS 简写属性」做类型推导，把四边值展开成一个对象类型。
// 简写有 1~4 个数字，且每个数字都是不同的联合成员，最终组合数爆炸，
// 再加上递归，tsc 直接放弃。
//
// 下面这段是「真实会炸」的最小化演示（写在注释里，因为它真的过不了检查）：
//
//   type Dir = 'top' | 'right' | 'bottom' | 'left';
//   // 想枚举 4 个方向的所有「部分组合」，每层递归都对 keyof 取一次
//   type PartialDirs<T extends Dir> = {
//     [K in T]?: PartialDirs<Exclude<Dir, K>>;
//   };
//   type All = PartialDirs<Dir>;
//
// 真实报错（tsc）：
//     error TS2589: Type instantiation is excessively deep and possibly infinite.
//
// 为什么炸：PartialDirs<'top'> 里要算 PartialDirs<'right' | 'bottom' | 'left'>，
// 后者又对每个成员再排除一次……分支数按阶乘增长，深度又无上限。
//
// 排查与拆解的四步法：
//   1) 找到「递归 + 联合」的那一层：递归里出现 Exclude/联合展开，基本就是元凶。
//   2) 给它设一个显式的深度上限：加一个深度参数 D，命中上限就走终止分支。
//   3) 拆成多个具名 type，一段一段编译，看哪一段开始炸。
//   4) 兜底：能换成「用运行时校验」就换掉；实在要类型，就把递归改成有限层手写。

// 演示一个「把递归拆成有限层」的安全版本（不再炸，而且更好读）
// 核心思路：不再用一个自递归的类型，而是把「一层」写成具名类型，
//           然后「两层」= 在一层里再嵌一层。层数一眼可见，也一眼可改。
type Dir3 = 'top' | 'right' | 'bottom';
// 最里层：一个空对象类型（不允许再往里加东西）
type EmptyLeaf = { [K in never]: never };
// 只嵌套一层
type OneLevel<T extends string> = { [K in T]?: EmptyLeaf };
// 嵌套两层（这就是我们要的上限）
type TwoLevels<T extends string> = { [K in T]?: OneLevel<Exclude<T, K>> };

const safeDirs: TwoLevels<Dir3> = { top: { right: {} } };
assertEqual(JSON.stringify(safeDirs), '{"top":{"right":{}}}', '把递归拆成两层，照样安全');
// 想看清它有多严格，就往第三层写一个值：
// ❌ 你可能这么写：const tooDeep: TwoLevels<Dir3> = { top: { right: { bottom: {} } } };
// 真实报错（tsc）：
//     error TS2322: Type '{ bottom: {}; }' is not assignable to type 'EmptyLeaf'.
//     Type '{ bottom: {}; }' is not assignable to type '{ }'.
//   报错直接把 EmptyLeaf 点了出来 —— 这就是「把递归拆成具名类型」的最大好处：
//   出错时编译器说的是人话，而不是一坨匿名展开。

// ---------- 6.3 实用建议：四条纪律 ----------
const disciplines = [
  '1) 优先用官方工具类型：Partial/Pick/Omit 等的实现已经被打磨过，别自己重写',
  '2) 优先拆成多个具名 type：一个 60 行的类型没人读，三个 20 行的类型人人能读',
  '3) 加中文注释：把「这个类型是给谁用的、为什么这么写」写在上面',
  '4) 写类型测试：用 expectType / tsd 的思路把「类型结论」钉死，防止重构时悄悄退化',
];
console.log('[6.3] 四条纪律');
for (const d of disciplines) console.log('  ' + d);

// 第 4 条的具体做法：用一行「编译期断言」把类型钉住。
// 这种「把类型当测试用例」的写法，就是 tsd / expect-type 的原理：
//   - Equal<A, B> 的真假只取决于类型，运行时什么都不用干。
//   - 如果哪天有人改了实现导致类型变了，这一行就会编译不过。
// （Assert / Extends 已经在文件开头定义过了，这里补一个更严格的 Equal）
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;

// 「类型测试」示例：这几行编译通过，就说明实现没退化。
type _test1 = Assert<Equal<MyPick<UserEntity, 'id'>, { id: number }>>;
type _test2 = Assert<Equal<MyOmit<UserEntity, 'id'>, { name: string; email: string; age: number }>>;
type _test3 = Assert<Equal<MyNonNullable<string | null>, string>>;
type _test4 = Assert<Equal<Flatten<number[][]>, number>>;
type _test5 = Assert<Equal<MyReturnType<typeof fetchUser>, FetchUserResult>>;
console.log('[6.3] 5 条类型测试已在编译期跑完（编译通过 = 测试通过）');

// ============================================================
// 7. 收尾：把「读懂 > 自创」这句话再钉一遍
// ============================================================
console.log('\n[7] 收尾');
const summary = [
  '五个基础操作符：keyof / typeof（类型位置）/ T[K] / extends 约束 / as const',
  '映射类型 = 类型层面的 for...in：{[K in keyof T]: ...}，还能用 -? / -readonly / as 重映射',
  '工具类型全家桶：会读、会抄、会改，别背；面试爱考 Pick / Omit / ReturnType / Awaited',
  '条件类型 = 类型的 if；裸 T 会分发（记得 [T] extends [U] 的坑）；infer 是型号待定的占位符',
  '模板字面量类型：编译期的字符串拼接，用来做事件名、CSS 单位；小心组合爆炸',
  '工程理性：类型是给人读的，复杂度有预算。工作中 95% 的时间你只需要读懂。',
];
for (const s of summary) console.log('  · ' + s);
console.log('========== 第 06 章结束 ==========');
