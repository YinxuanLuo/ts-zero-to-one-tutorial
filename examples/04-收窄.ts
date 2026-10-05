/**
 * 第 04 章配套代码：联合类型与类型收窄
 *
 * 运行：node 04-收窄.ts
 * 检查：npx tsc --noEmit
 *
 * 本章是全书最重要的一章。建议你把每个函数都改一改，看编译器怎么反应。
 */

console.log('========== 4.1 联合类型 ==========');

function formatId(id: string | number): string {
  // 不收窄就只能用共有属性；这里的 typeof 就是收窄
  return typeof id === 'number' ? id.toFixed(0) : id.trim();
}
console.log('联合类型:', formatId(42), formatId('  7  '));

console.log('\n========== 4.2 字面量类型 ==========');

type Direction = 'up' | 'down' | 'left' | 'right';

function move(d: Direction): string {
  switch (d) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'left':
      return '←';
    case 'right':
      return '→';
    default:
      return assertNever(d);
  }
}
console.log('字面量联合:', ['up', 'down', 'left', 'right'].map((d) => move(d as Direction)).join(' '));

// as const 的经典用法：数组 → 联合类型，两者永不脱节
const COLORS = ['red', 'green', 'blue'] as const;
type Color = (typeof COLORS)[number];
//   ^? "red" | "green" | "blue"

function isColor(v: string): v is Color {
  return (COLORS as readonly string[]).includes(v);
}
console.log('as const 推联合:', COLORS.join(','), '| isColor("red") =', isColor('red'), '| isColor("pink") =', isColor('pink'));

console.log('\n========== 4.3 收窄的十种手段 ==========');

// 手段 1：typeof
function describePrimitive(x: string | number | boolean | null | undefined): string {
  if (typeof x === 'string') return `string: ${x.toUpperCase()}`;
  if (typeof x === 'number') return `number: ${x.toFixed(2)}`;
  if (typeof x === 'boolean') return `boolean: ${x ? '真' : '假'}`;
  if (x === null) return 'null';
  if (x === undefined) return 'undefined';
  return assertNever(x);
}
console.log('typeof:', describePrimitive('hi'), '|', describePrimitive(3.14159), '|', describePrimitive(true));
console.log('typeof:', describePrimitive(null), '|', describePrimitive(undefined));

// 手段 2：真值判断（注意空字符串的坑）
function truthiness(x: string | null | undefined): string {
  if (x) return `有值: ${x}`;
  return '空或没有';
}
console.log('真值判断:', truthiness('a'), '|', truthiness(''), '← 空字符串被当成没有值');
// 更安全的写法：用 != null 同时排除 null 和 undefined
function safeCheck(x: string | null | undefined): string {
  if (x != null) return `有值: "${x}"`;
  return 'null 或 undefined';
}
console.log('!= null:', safeCheck(''), '← 空字符串被保留了');

// 手段 3：相等比较
function compare(x: 'a' | 'b' | 'c'): string {
  if (x === 'a') return '第一个';
  // 这里 TS 已经知道 x 是 'b' | 'c'
  if (x !== 'b') return '只能是 c';
  return '第二个';
}
console.log('相等比较:', compare('a'), compare('b'), compare('c'));

// 手段 4：in
type Cat = { meow: () => string };
type Dog = { bark: () => string };

function play(pet: Cat | Dog): string {
  if ('meow' in pet) return pet.meow();
  return pet.bark();
}
console.log('in 收窄:', play({ meow: () => '喵' }), play({ bark: () => '汪' }));

// 手段 5：instanceof
function describeError(e: Date | Error): string {
  if (e instanceof Date) return `时间戳 ${e.getTime()}`;
  return `错误: ${e.message}`;
}
console.log('instanceof:', describeError(new Date(0)), '|', describeError(new Error('炸了')));

// 手段 6：Array.isArray
function joinOrUpper(x: string | string[]): string {
  if (Array.isArray(x)) return x.join(' + ');
  return x.toUpperCase();
}
console.log('Array.isArray:', joinOrUpper(['a', 'b']), '|', joinOrUpper('ab'));

// 手段 8：自定义类型谓词 x is T
interface User {
  id: number;
  name: string;
}

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'number' && typeof v.name === 'string';
}

function greetUser(input: unknown): string {
  if (isUser(input)) {
    return `你好，${input.name}（id=${input.id}）`;
  }
  return '不是用户';
}
console.log('类型谓词:', greetUser({ id: 1, name: 'Tom' }), '|', greetUser({ id: '1' }), '|', greetUser(null));

// 手段 9：断言函数 asserts x is T
function assertIsUser(value: unknown): asserts value is User {
  if (!isUser(value)) {
    throw new Error(`不是合法的 User: ${JSON.stringify(value)}`);
  }
}

function handleWithAssert(input: unknown): string {
  assertIsUser(input);
  // 这行之后 input 已经是 User 了
  return `断言通过: ${input.name}`;
}
console.log('断言函数:', handleWithAssert({ id: 2, name: 'Jerry' }));
try {
  handleWithAssert({ nope: true });
} catch (e) {
  console.log('断言函数抛错:', (e as Error).message);
}

// 手段 10：赋值收窄
let assigned: string | number = 'x';
assigned = 42;
console.log('赋值收窄:', assigned.toFixed(1));

// 4.3.3 闭包里保住收窄
function keepNarrow(x: string | null): () => string {
  if (x === null) return () => '';
  const snapshot = x; // 存成 const，收窄被锁死
  return () => snapshot.toUpperCase();
}
console.log('闭包收窄:', keepNarrow('hi')(), '|', JSON.stringify(keepNarrow(null)()));

console.log('\n========== 4.4 判别联合 ==========');

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: string[] }
  | { status: 'error'; error: string };

function renderState(state: LoadState): string {
  switch (state.status) {
    case 'idle':
      return '还没开始';
    case 'loading':
      return '加载中...';
    case 'success':
      // 这里 state.data 直接可用，不需要任何 ?. 或 !
      return `拿到 ${state.data.length} 条：${state.data.join(', ')}`;
    case 'error':
      return `出错：${state.error}`;
    default:
      return assertNever(state);
  }
}

const states: LoadState[] = [
  { status: 'idle' },
  { status: 'loading' },
  { status: 'success', data: ['a', 'b'] },
  { status: 'error', error: '网络超时' },
];
states.forEach((s) => console.log('  判别联合:', renderState(s)));

// 试着解开下面的注释，感受编译器怎么拦你：
// const bad1: LoadState = { status: 'loading', data: [] };   // TS2353
// const bad2: LoadState = { status: 'success' };             // TS2741

console.log('\n========== 4.4 实战：Result 类型 ==========');

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; statusCode: number };

// 用假的 fetch 演示，保证示例可以离线跑
async function fakeFetch<T>(shouldSucceed: boolean, payload: T): Promise<ApiResult<T>> {
  if (shouldSucceed) {
    return { ok: true, data: payload };
  }
  return { ok: false, error: '请求失败', statusCode: 500 };
}

async function demoResult(): Promise<void> {
  const ok = await fakeFetch(true, { id: 1, name: 'Tom' });
  if (ok.ok) {
    console.log('  Result 成功分支:', ok.data.name); // 这里只有 data
  }

  const bad = await fakeFetch(false, { id: 1, name: 'Tom' });
  if (!bad.ok) {
    console.log('  Result 失败分支:', bad.error, bad.statusCode); // 这里只有 error
  }
}
await demoResult();

console.log('\n========== 4.5 穷尽检查 ==========');

function assertNever(value: never): never {
  throw new Error(`分支未穷尽，收到了: ${JSON.stringify(value)}`);
}

type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle':
      return Math.PI * s.radius ** 2;
    case 'square':
      return s.side ** 2;
    default:
      return assertNever(s);
  }
}
console.log('面积:', area({ kind: 'circle', radius: 1 }).toFixed(4), area({ kind: 'square', side: 3 }));

// 练习：给 Shape 加上 | { kind: 'triangle'; base: number; height: number }
// 你会发现 area 立刻编译报错，提醒你漏了分支。

console.log('\n========== 4.6 可选链与空值合并 ==========');

type Profile = {
  name: string;
  address?: { city: string; geo?: { lat: number; lng: number } };
};

const p1: Profile = { name: 'Tom', address: { city: '北京', geo: { lat: 39.9, lng: 116.4 } } };
const p2: Profile = { name: 'Jerry' };

console.log('可选链:', p1.address?.city, '|', p2.address?.city, '|', p2.address?.geo?.lat);

// || 和 ?? 的区别（这是线上事故高发区）
type Cfg = { port?: number; retries?: number; name?: string };
function badDefaults(c: Cfg) {
  return { port: c.port || 3000, retries: c.retries || 3, name: c.name || '默认' };
}
function goodDefaults(c: Cfg) {
  return { port: c.port ?? 3000, retries: c.retries ?? 3, name: c.name ?? '默认' };
}
const edge: Cfg = { port: 0, retries: 0, name: '' };
console.log('用 || 的坑:', JSON.stringify(badDefaults(edge)), '← 0 和空串被吃掉了');
console.log('用 ?? 正确:', JSON.stringify(goodDefaults(edge)));

console.log('\n========== 4.7 推断类型谓词（TS 5.5+） ==========');

type Cat2 = { kind: 'cat'; meow: () => string };
type Dog2 = { kind: 'dog'; bark: () => string };
type Pet = Cat2 | Dog2;

// ✅ 显式类型谓词：推荐写法，因为 `p is Cat2` 本身就是一份文档
function isCat(p: unknown): p is Cat2 {
  return (
    typeof p === 'object' &&
    p !== null &&
    'kind' in p &&
    (p as { kind: unknown }).kind === 'cat'
  );
}

// TS 5.5+ 也能自动推断：不写返回类型、函数体是可直接追踪的收窄表达式即可。
// 例如下面这个函数，编译器会自动推断出 `p is Dog2`：
//
//   function isDog(p: unknown) {
//     return typeof p === 'object' && p !== null && 'bark' in p;
//   }
//
// 但只要你写上 `: boolean`，推断就会被关掉，收窄也就失效了。
// 所以：想让它收窄，就别写 `: boolean`；最好还是显式写 `x is T`。
function isDog(p: unknown): p is Dog2 {
  return typeof p === 'object' && p !== null && 'bark' in p;
}

function petSound(p: Pet): string {
  if (isCat(p)) return p.meow();
  if (isDog(p)) return p.bark();
  return '';
}
console.log(
  '类型谓词两种写法:',
  petSound({ kind: 'cat', meow: () => '喵' }),
  petSound({ kind: 'dog', bark: () => '汪' }),
);

console.log('\n全部示例运行完毕。');
