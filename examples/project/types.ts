// ============================================================================
// types.ts —— 全项目的"类型地基"
//
// 这里只放类型和小工具函数，不放业务逻辑。
// 对应第 09 章的四个模式：
//   1. Branded Type（品牌类型）        —— TaskId
//   2. 判别联合（discriminated union） —— TaskStatus
//   3. Result<T, E>                    —— 不抛异常的错误处理
//   4. assertNever                     —— 穷尽检查
// ============================================================================

// ---------------------------------------------------------------------------
// 【模式 3】Result<T, E>：用"返回值"表示失败，而不是用异常
// ---------------------------------------------------------------------------
//
// 人话：函数要么成功（带着数据），要么失败（带着原因），两种可能都写在返回值里。
//
// 术语：这是一个"判别联合"（discriminated union），判别字段是 `ok`。
//   - ok: true  这一支携带 value
//   - ok: false 这一支携带 error
//
// 为什么要自己定义：`try/catch` 里 catch 到的变量类型是 `unknown`（第 01 章），
// 你被迫写 `if (e instanceof Error)`，而且"这个函数会失败"这件事没有写进签名，
// 调用者不看实现根本不知道要 try。
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

/** 构造一个"成功"结果。显式标注返回类型，避免字面量被推成 boolean。 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** 构造一个"失败"结果。 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * 成功就变换其中的值，失败就原样透传。
 * 这是 Result 版的 `Array.prototype.map`，用来串起一条"都是成功路径"的处理链。
 */
export function map<T, U, E>(r: Result<T, E>, f: (value: T) => U): Result<U, E> {
  if (!r.ok) return r; // 失败分支：类型上已经知道是 Err<E>，直接透传
  return ok(f(r.value));
}

/**
 * 成功就取出来，失败就用兜底值。
 * 相当于 Result 版的 `??`：调用点不想处理错误时，至少还能拿到一个值。
 */
export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

// ---------------------------------------------------------------------------
// 【模式 1】Branded Type：给 string 加上"语义"
// ---------------------------------------------------------------------------
//
// 人话：`TaskId` 和 `UserId` 底层都是字符串，编译器本来分不清；
//       我给它们各贴一张"看不见的标签"，贴错标签就报错。
//
// 术语：在结构化类型系统里模拟"名义类型"（nominal typing）。
//       那个 `__brand` 字段在运行时根本不存在，只在类型层面留个记号。
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** 任务 ID：只能由 taskId() 造出来，普通字符串赋值会报错。 */
export type TaskId = Brand<string, 'TaskId'>;

/**
 * 唯一的构造入口（也叫"智能构造器"）。
 * 所有外部字符串想变成 TaskId，都必须从这里过一道校验。
 */
export function taskId(raw: string): Result<TaskId, string> {
  const trimmed = raw.trim();
  if (trimmed.length < 3) {
    return err(`任务 ID 至少 3 个字符，收到：${JSON.stringify(raw)}`);
  }
  // 这里是全项目唯一允许把 string 断言成 TaskId 的地方。
  // 类型断言是"我对编译器打包票"，所以只准出现在有真校验守着的地方。
  return ok(trimmed as TaskId);
}

// ---------------------------------------------------------------------------
// 【模式 2】判别联合：把任务的三种状态写成三个互斥的形状
// ---------------------------------------------------------------------------
//
// 为什么不用 `status: string` 加几个 if：那样 `done` 状态也能带上"进度百分比"，
// 非法状态在类型上完全合法。判别联合让"没做完却填了完成时间"这种事写不出来。
export type TaskStatus =
  | { readonly kind: 'todo' }
  | { readonly kind: 'doing'; readonly startedAt: string }
  | { readonly kind: 'done'; readonly startedAt: string; readonly finishedAt: string };

/** 任务实体：仓库里存的就是它。 */
export interface Task {
  readonly id: TaskId;
  readonly title: string;
  readonly status: TaskStatus;
}

/** 给日志用的一行摘要：这里必须穷尽处理 kind，否则 assertNever 会报错。 */
export function describeStatus(status: TaskStatus): string {
  switch (status.kind) {
    case 'todo':
      return '待办';
    case 'doing':
      return `进行中（开始于 ${status.startedAt}）`;
    case 'done':
      return `已完成（${status.startedAt} → ${status.finishedAt}）`;
    default:
      // 走到这里说明上面漏了一个分支，而这行的类型只有 never 能赋值。
      return assertNever(status);
  }
}

// ---------------------------------------------------------------------------
// 【模式 4】assertNever：把"忘记处理新分支"变成编译错误
// ---------------------------------------------------------------------------
//
// 参数类型是 never，意味着"永远不该有人调用我"。
// 一旦你往 TaskStatus 里加了 `{ kind: 'archived' }`，所有 switch 的 default 分支
// 立刻编译不过——这就是它的全部价值：让编译器追着你改。
export function assertNever(value: never): never {
  throw new Error(`未处理的分支：${JSON.stringify(value)}`);
}
