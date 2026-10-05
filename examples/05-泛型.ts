/**
 * 第 05 章配套代码：泛型
 *
 * 运行：node 05-泛型.ts
 * 检查：npx tsc --noEmit
 */

console.log('========== 5.1 泛型 = 类型版的函数参数 ==========');

// ❌ 用 any 的版本：类型信息全丢
function badIdentity(value: any): any {
  return value;
}

// ✅ 用泛型的版本：类型被原样保留
function identity<T>(value: T): T {
  return value;
}

const fromAny = badIdentity(42);
const fromGeneric = identity(42);

console.log('any 版本的结果:', fromAny, '(类型信息丢了)');
console.log('泛型版本的结果:', fromGeneric, '(类型是 42)');

// 关系证明：两个参数必须是同一种类型
function pairSame<T>(first: T, second: T): [T, T] {
  return [first, second];
}
console.log('同类型约束:', pairSame(1, 2), pairSame('a', 'b'));
// pairSame(1, 'b');   // ❌ 解开注释看报错

console.log('\n========== 5.2 泛型用在三个地方 ==========');

// 地方 1：函数
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
console.log('泛型函数:', first([1, 2, 3]), first(['x', 'y']), first([]));

// 箭头函数写法（.tsx 里要写成 <T,>）
const last = <T,>(arr: T[]): T | undefined => arr[arr.length - 1];
console.log('箭头泛型函数:', last([1, 2, 3]));

// 地方 2：接口 / 类型别名
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

const userResp: ApiResponse<{ id: number; name: string }> = {
  code: 0,
  message: 'ok',
  data: { id: 1, name: 'Tom' },
};
console.log('泛型接口:', userResp.data.name);

// 地方 3：类
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  get size(): number {
    return this.items.length;
  }
}

const numStack = new Stack<number>();
numStack.push(1);
numStack.push(2);
// numStack.push('a');   // ❌ 解开注释看报错
console.log('泛型类:', numStack.pop(), '剩余', numStack.size);

// 泛型仓库
class Repository<T extends { id: string }> {
  private store = new Map<string, T>();

  save(entity: T): void {
    this.store.set(entity.id, entity);
  }

  findById(id: string): T | undefined {
    return this.store.get(id);
  }

  all(): T[] {
    return [...this.store.values()];
  }
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const products = new Repository<Product>();
products.save({ id: 'p1', name: '键盘', price: 299 });
products.save({ id: 'p2', name: '鼠标', price: 99 });
console.log('Repository:', products.findById('p1')?.name, '共', products.all().length, '件');

console.log('\n========== 5.3 类型参数只在编译期存在 ==========');

// T 在运行时不存在，所以不能 new T()，要把构造函数传进来
function create<T>(Ctor: new () => T): T {
  return new Ctor();
}

class Cat {
  meow(): string {
    return '喵';
  }
}
const cat = create(Cat);
console.log('把构造函数当参数:', cat.meow(), '| instanceof Cat =', cat instanceof Cat);

console.log('\n========== 5.4 泛型约束 extends ==========');

// 无约束的 T 什么都不能做 → 必须约束
function describeNamed<T extends { name: string }>(obj: T): string {
  return `名字是 ${obj.name}`;
}
console.log('约束:', describeNamed({ name: 'Tom' }), '|', describeNamed({ name: 'Book', pages: 100 }));

// 黄金组合：K extends keyof T + T[K]
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: 'Tom', active: true };
const userId = get(user, 'id');
const userName = get(user, 'name');
// get(user, 'nmae');   // ❌ 拼错立刻报错
console.log('keyof 约束:', userId, userName);

// 多个约束用 & 交叉
function audit<T extends { id: string } & { createdAt: Date }>(x: T): string {
  return `${x.id} @ ${x.createdAt.toISOString()}`;
}
console.log('多约束:', audit({ id: 'a1', createdAt: new Date(0) }));

console.log('\n========== 5.5 泛型默认值 ==========');

interface Resp<T = unknown> {
  ok: boolean;
  data: T;
}
const rDefault: Resp = { ok: true, data: { anything: 1 } };
const rTyped: Resp<number> = { ok: true, data: 1 };
console.log('泛型默认值:', rDefault.ok, rTyped.data.toFixed(1));

interface Pair<A, B = A> {
  first: A;
  second: B;
}
const samePair: Pair<number> = { first: 1, second: 2 };
const mixedPair: Pair<number, string> = { first: 1, second: 'a' };
console.log('默认值引用前一个参数:', samePair, mixedPair);

console.log('\n========== 5.6 泛型推断 ==========');

// 从参数推断
const inferred = identity('hello');
console.log('从参数推断:', inferred);

// 返回值无法推断 T，必须显式写
function makeArray<T>(): T[] {
  return [];
}
const explicit = makeArray<number>();
explicit.push(1);
// explicit.push('a');   // ❌ 解开注释看报错
console.log('显式指定 T:', explicit);

// 上下文推断
const lengths = ['a', 'bb', 'ccc'].map((s) => s.length);
console.log('上下文推断:', lengths);

console.log('\n========== 5.7 实战泛型模式 ==========');

// 模式 1：Result<T>
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}
function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err('除数不能为 0');
  return ok(a / b);
}

for (const [a, b] of [[10, 2], [1, 0]] as const) {
  const res = divide(a, b);
  console.log(`  ${a} / ${b} =`, res.ok ? res.value.toFixed(2) : `失败(${res.error})`);
}

// 模式 2：pluck
function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

const users = [
  { id: 1, name: 'Tom', age: 18 },
  { id: 2, name: 'Jerry', age: 20 },
  { id: 3, name: 'Spike', age: 18 },
];
console.log('pluck 名字:', pluck(users, 'name'));
console.log('pluck 年龄:', pluck(users, 'age'));

// 模式 3：groupBy
function groupBy<T, K extends keyof T>(items: T[], key: K): Map<T[K], T[]> {
  const map = new Map<T[K], T[]>();
  for (const item of items) {
    const k = item[key];
    const bucket = map.get(k);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
}
const byAge = groupBy(users, 'age');
console.log('groupBy 18 岁:', byAge.get(18)?.map((u) => u.name));

// 模式 4：useState 风格的元组
type Setter<T> = (next: T | ((prev: T) => T)) => void;

function createState<T>(initial: T): [() => T, Setter<T>] {
  let value = initial;
  const getter = (): T => value;
  const setter: Setter<T> = (next) => {
    value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
  };
  return [getter, setter];
}

const [getCount, setCount] = createState(0);
setCount(1);
setCount((prev) => prev + 1);
setCount((prev) => prev * 10);
console.log('createState:', getCount());

// 模式 5：类型安全的 fetchJson（用假的 fetch，保证示例离线可跑）
type Validator<T> = (raw: unknown) => T;

function isUserObject(raw: unknown): raw is { id: number; name: string } {
  if (typeof raw !== 'object' || raw === null) return false;
  const o = raw as Record<string, unknown>;
  return typeof o.id === 'number' && typeof o.name === 'string';
}

function validateUser(raw: unknown): { id: number; name: string } {
  if (!isUserObject(raw)) throw new Error('响应格式不是 User');
  return raw;
}

async function fetchJson<T>(url: string, validate: Validator<T>): Promise<T> {
  // 真实项目里这里是 fetch(url)；示例里用一个假响应
  const fakeRaw: unknown = url.includes('user') ? { id: 1, name: 'Tom', extra: 'ignored' } : {};
  return validate(fakeRaw);
}

const fetchedUser = await fetchJson('/api/user/1', validateUser);
console.log('fetchJson + 运行时校验:', fetchedUser.name);

// 模式 6：插件系统
interface Plugin<TOptions> {
  name: string;
  defaultOptions: TOptions;
  setup(options: TOptions): void;
}

function usePlugin<TOptions>(plugin: Plugin<TOptions>, options: TOptions): void {
  plugin.setup({ ...plugin.defaultOptions, ...options });
}

const loggerPlugin: Plugin<{ level: 'info' | 'warn'; prefix: string }> = {
  name: 'logger',
  defaultOptions: { level: 'info', prefix: '[app]' },
  setup(options) {
    console.log(`  插件 ${loggerPlugin.name}: prefix=${options.prefix} level=${options.level}`);
  },
};

usePlugin(loggerPlugin, { level: 'warn', prefix: '[db]' });
// usePlugin(loggerPlugin, { level: 'debug', prefix: '[db]' });   // ❌ 解开注释看报错

console.log('\n========== 5.8 泛型误用 ==========');

// 误用 1：T 只出现一次 —— 用 unknown 更诚实
function logOnce(value: unknown): void {
  console.log('  只出现一次的类型参数，不如写 unknown:', value);
}
logOnce('hi');

// 误用 4：用 as 骗编译器（下面这个只做说明，不要学）
function dangerousCast<T>(value: string): T {
  return value as unknown as T;   // ❌ 类型系统与运行时彻底脱节
}
console.log('  危险转换（反面教材）:', dangerousCast<string>('其实没问题'), '← 但换个 T 就会炸');

console.log('\n========== 5.9 决策对照 ==========');
console.log('  any     → 迁移旧代码的临时逃生舱');
console.log('  unknown → 外部数据入口（推荐）');
console.log('  泛型<T> → 复用逻辑 + 保持类型关系（推荐）');

console.log('\n全部示例运行完毕。');
