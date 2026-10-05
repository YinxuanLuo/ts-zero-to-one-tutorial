// ============================================================================
// service.ts —— 业务逻辑层
//
// 这一层的职责：
//   1. 检查"这件事业务上能不能做"（比如：已完成的任务不能重新开始）
//   2. 所有可能失败的操作，都返回 Result<T, TaskError>，不抛异常
//
// 对应第 09 章的模式：
//   2. 判别联合建模状态机（TaskStatus + StateMachine）
//   3. Result<T, E> 串起业务链路
//   6. 依赖注入：service 只认 Repository<Task> 接口，不认具体实现
// ============================================================================

import type { Repository, RepoError } from './store.ts';
import { RepoErrorKind, describeRepoError } from './store.ts';
import type { Result, Task, TaskId } from './types.ts';
import { assertNever, err, ok, taskId } from './types.ts';

// ---------------------------------------------------------------------------
// 业务错误：判别联合 + 参数化（泛型）
// ---------------------------------------------------------------------------
//
// 为什么给 RepoError 单独留一个分支，而不是把它的 kind 平铺进来？
// 因为这样"谁的错误"在类型上是分开的：
// 你想拿到 RepoError 就必须先收窄到 cause.kind === 'repo'。
//
// 顺带一个细节：`{ kind: 'repo'; cause: RepoError }` 里的 `kind` 是字面量类型，
// TS 会把它当作判别字段，所以 switch 能正确收窄。
export type TaskError =
  | { readonly kind: 'invalid-id'; readonly raw: string; readonly reason: string }
  | { readonly kind: 'empty-title' }
  | { readonly kind: 'repo'; readonly cause: RepoError }
  | {
      readonly kind: 'invalid-transition';
      readonly id: TaskId;
      readonly from: Task['status']['kind'];
      readonly to: Task['status']['kind'];
    };

/** 把任意 TaskError 翻成中文。注意这里必须以 assertNever 收尾。 */
export function describeTaskError(e: TaskError): string {
  switch (e.kind) {
    case 'invalid-id':
      return `任务 ID 不合法：${e.reason}（原值 ${JSON.stringify(e.raw)}）`;
    case 'empty-title':
      return '任务标题不能为空';
    case 'repo':
      return describeRepoError(e.cause);
    case 'invalid-transition':
      return `非法状态转换：${e.id} 不能从 ${e.from} 直接变成 ${e.to}`;
    default:
      return assertNever(e);
  }
}

/** RepoError -> TaskError 的适配器：把底层错误"翻译"成业务层能表达的错误。 */
function fromRepo(cause: RepoError): TaskError {
  return { kind: 'repo', cause };
}

// ---------------------------------------------------------------------------
// 【模式 2 的核心】状态机
// ---------------------------------------------------------------------------
//
// 人话：任务的合法走法是一张固定的图，我只是把这张图写成数据。
//
//    todo ──► doing ──► done
//
// `satisfies Record<Kind, readonly Kind[]>` 的意思是：
// "请检查我的**值**符合这张表的形状，但别把我的类型擦成宽泛的 Record"。
// 这样 ALLOWED.done 的类型是 readonly ['done']（能看出长度），
// 而不是 readonly Kind[]（看不出内容）。
export type StatusKind = Task['status']['kind'];

export const ALLOWED = {
  todo: ['doing'],
  doing: ['done'],
  done: ['done'], // 已完成是终态；允许"再完成一次"= 幂等
} as const satisfies Record<StatusKind, readonly StatusKind[]>;

/** 纯函数：只回答"能不能转"，不碰数据。 */
export function canTransition(from: StatusKind, to: StatusKind): boolean {
  // 一个真实的坑：直接写 `ALLOWED[from].includes(to)` 会报 TS2345
  // （Argument of type 'StatusKind' is not assignable to parameter of type 'never'）。
  // 原因见第 09 章 9.2 节：from 是联合类型时，ALLOWED[from] 得到的是
  // 三个元组类型的"交集"，而 ['doing'] 和 ['done'] 的元素交集是 never。
  // 修法只有一行：先用带注解的本地变量把三个分支合并回 readonly StatusKind[]。
  const allowed: readonly StatusKind[] = ALLOWED[from];
  return allowed.includes(to);
}

/** 生成转换后的新 status。判别联合保证每个分支带的字段都是对的。 */
function nextStatus(status: Task['status'], to: StatusKind): Task['status'] | undefined {
  if (!canTransition(status.kind, to)) return undefined;

  switch (to) {
    case 'todo':
      return { kind: 'todo' };
    case 'doing':
      // 如果本来就是 doing，保留原来的开始时间（不要重新计时）
      return status.kind === 'doing'
        ? status
        : { kind: 'doing', startedAt: new Date().toISOString() };
    case 'done':
      return status.kind === 'done'
        ? status
        : {
            kind: 'done',
            startedAt: status.kind === 'doing' ? status.startedAt : new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          };
    default:
      return assertNever(to);
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
//
// 【模式 6】依赖注入：构造函数只要求一个 `Repository<Task>`。
// 因为 TS 是结构化类型（第 00 章），测试时你只要给一个"长得像仓库"的对象字面量
// 就行，完全不需要 mock 库、不需要实现整个接口之外的东西。
//
// 这里同样没用构造函数参数属性，保持 Node strip 模式可运行。
export class TaskService {
  readonly #repo: Repository<Task>;

  constructor(repo: Repository<Task>) {
    this.#repo = repo;
  }

  /** 创建任务：两处可预期的失败（ID 不合法、标题为空）都用 Result 返回。 */
  createTask(rawId: string, rawTitle: string): Result<Task, TaskError> {
    const idResult = taskId(rawId);
    if (!idResult.ok) {
      return err({ kind: 'invalid-id', raw: rawId, reason: idResult.error });
    }

    const title = rawTitle.trim();
    if (title.length === 0) {
      return err({ kind: 'empty-title' });
    }

    const task: Task = { id: idResult.value, title, status: { kind: 'todo' } };
    const saved = this.#repo.save(task);
    if (!saved.ok) return err(fromRepo(saved.error));
    return ok(saved.value);
  }

  /** 按 id 找一个任务。 */
  getTask(id: TaskId): Result<Task, TaskError> {
    const found = this.#repo.find(id);
    if (!found.ok) return err(fromRepo(found.error));
    return ok(found.value);
  }

  /** 列出全部任务。这个操作不可能失败，所以直接返回数组，不用 Result。 */
  listTasks(): readonly Task[] {
    return this.#repo.list();
  }

  /**
   * 状态转换的唯一入口。
   *
   * 注意 `if (!taskResult.ok) return ...` 这种写法：先处理失败分支，
   * 之后 TS 就自动把 taskResult 收窄成 Ok<Task>，可以直接取 .value。
   * 这是 Result 在 TS 里最常见的用法（TS 没有 Rust 的 `?`，只能靠早返回）。
   */
  transition(id: TaskId, to: StatusKind): Result<Task, TaskError> {
    const taskResult = this.#repo.find(id);
    if (!taskResult.ok) return err(fromRepo(taskResult.error));

    const task = taskResult.value;
    const from = task.status.kind;

    const next = nextStatus(task.status, to);
    if (next === undefined) {
      return err({ kind: 'invalid-transition', id, from, to });
    }

    const updated: Task = { ...task, status: next };
    // 状态更新是"覆盖已有记录"，所以用 upsert 而不是 save
    // （save 的语义是"插入"，遇到同 id 会返回 duplicate-id）。
    const saved = this.#repo.upsert(updated);
    if (!saved.ok) return err(fromRepo(saved.error));
    return ok(saved.value);
  }

  startTask(id: TaskId): Result<Task, TaskError> {
    return this.transition(id, 'doing');
  }

  finishTask(id: TaskId): Result<Task, TaskError> {
    return this.transition(id, 'done');
  }

  /** 删除任务。 */
  removeTask(id: TaskId): Result<Task, TaskError> {
    const removed = this.#repo.remove(id);
    if (!removed.ok) return err(fromRepo(removed.error));
    return ok(removed.value);
  }

  /** 统计各状态的数量。返回 Record，调用方拿到的键是受约束的。 */
  stats(): Record<StatusKind, number> {
    const acc: Record<StatusKind, number> = { todo: 0, doing: 0, done: 0 };
    for (const t of this.#repo.list()) {
      acc[t.status.kind] += 1;
    }
    return acc;
  }
}

/** 给 main.ts 用的小工具：把 RepoErrorKind 也导出一次，省得两处 import。 */
export { RepoErrorKind };
