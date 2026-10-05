/**
 * 第 10 章 第五关 · 第 2 题参考答案：Result<T, E> 工具箱
 *
 * 运行：node answers/a2-result.ts
 */

console.log('========== 第 2 题：Result<T, E> 工具箱 ==========');

type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

function map<T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r; // 失败分支原样传下去，E 不变
}

function mapErr<T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> {
  return r.ok ? r : err(f(r.error)); // 成功分支原样传下去，T 不变
}

function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

// ---- 验证 ----
const a = map(ok(2), (n) => n * 2);
//    ^? Result<number, never>
const b = map(err('boom'), (n: number) => n * 2);
//    ^? Result<number, string>

console.log('  map(ok(2)) =>', unwrapOr(a, 0));
console.log('  map(err)   =>', unwrapOr(b, -1));

const c = mapErr(b, (e) => ({ message: e, code: 500 }));
//    ^? Result<number, { message: string; code: number }>
console.log('  mapErr 后:', c.ok ? c.value : c.error.code);

// 链式组合：注意 TS 没有 Rust 的 ? 运算符，所以实际项目里通常写一个 run 辅助函数
function run<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(`Result 是失败态: ${JSON.stringify(r.error)}`);
}

const pipeline = mapErr(map(ok('42'), (s) => Number(s)), (e) => `解析失败: ${String(e)}`);
console.log('  管道结果:', run(pipeline));

console.log('\n第 2 题完成。');
