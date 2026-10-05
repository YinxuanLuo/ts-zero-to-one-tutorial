// ============================================================================
// store.ts —— 数据存取层
//
// 这一层只干一件事：把东西存进去、取出来、删掉。
// 它不问"这个操作业务上合不合法"，那是 service.ts 的事。
//
// 对应第 09 章的模式：
//   5. 泛型 Repository<T>：外壳复用，数据类型由调用方定制
//   6. 依赖注入 + 结构化类型：接口 + 实现，测试时可以直接塞对象字面量
//   3. Result<T, E>：查找失败用返回值表达，不抛异常
// ============================================================================

import type { Result } from './types.ts';
import { err, ok } from './types.ts';

/**
 * 仓库能出的两种错。
 *
 * 注意这里没有用字面量联合，而是建了一个"错误码表"对象，
 * 再用 `typeof` + 索引访问把类型从**值**里推导出来（第 06 章的技巧）。
 * 好处：错误码只写一遍，改字符串不会漏掉类型。
 */
export const RepoErrorKind = {
  NotFound: 'not-found',
  DuplicateId: 'duplicate-id',
} as const;
export type RepoErrorKind = (typeof RepoErrorKind)[keyof typeof RepoErrorKind];

export interface RepoError {
  readonly kind: RepoErrorKind;
  readonly id: string;
}

export function repoError(kind: RepoErrorKind, id: string): RepoError {
  return { kind, id };
}

/**
 * 泛型约束 `T extends { id: string }` 的意思是：
 * "随便你存什么，但必须身上有个 string 类型的 id"。
 * 有了这条约束，我才能在 find/delete 里直接读 `item.id`，否则编译器不让我读。
 */
export interface Repository<T extends { id: string }> {
  find(id: string): Result<T, RepoError>;
  list(): readonly T[];
  /** 插入：id 已存在就报 duplicate-id。 */
  save(item: T): Result<T, RepoError>;
  /** 插入或覆盖：已存在就替换。状态机更新任务时必须用它，不能用 save。 */
  upsert(item: T): Result<T, RepoError>;
  remove(id: string): Result<T, RepoError>;
}

/**
 * 泛型类：把所有 T 换成真实类型即可，仓库逻辑写一遍就够。
 *
 * 这里**没有**用构造函数参数属性（`constructor(private items = ...)`），
 * 因为 Node 直接跑 .ts 时 strip 模式不支持那个语法（第 07 章讲过）。
 */
export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  readonly #items = new Map<string, T>();

  /** 有 getter，没有 setter：对外只读，防止外部直接改内部数据。 */
  get size(): number {
    return this.#items.size;
  }

  find(id: string): Result<T, RepoError> {
    const found = this.#items.get(id);
    if (found === undefined) {
      return err(repoError(RepoErrorKind.NotFound, id));
    }
    return ok(found);
  }

  /**
   * 返回 readonly T[]：数组本身不可变，里面的元素类型也带 readonly 字段。
   * 调用方想改，只能走 save()，这样所有写入都过一道检查。
   */
  list(): readonly T[] {
    return [...this.#items.values()];
  }

  save(item: T): Result<T, RepoError> {
    if (this.#items.has(item.id)) {
      return err(repoError(RepoErrorKind.DuplicateId, item.id));
    }
    this.#items.set(item.id, item);
    return ok(item);
  }

  /**
   * 插入或覆盖：有就替换，没有就新增，两种情况都算成功。
   *
   * 为什么不复用一个 update 方法搞定：因为"哪个算成功"是业务判断。
   * 仓库只提供两种语义明确的操作，让调用方明确选一个，
   * 而不是给一个含糊的 set() 然后在文档里写"行为取决于是否已存在"。
   */
  upsert(item: T): Result<T, RepoError> {
    this.#items.set(item.id, item);
    return ok(item);
  }

  remove(id: string): Result<T, RepoError> {
    const found = this.#items.get(id);
    if (found === undefined) {
      return err(repoError(RepoErrorKind.NotFound, id));
    }
    this.#items.delete(id);
    return ok(found);
  }
}

/** 把 RepoError 翻译成给人看的中文。集中在一处，改文案只改这里。 */
export function describeRepoError(e: RepoError): string {
  switch (e.kind) {
    case RepoErrorKind.NotFound:
      return `找不到 id 为 ${e.id} 的记录`;
    case RepoErrorKind.DuplicateId:
      return `id ${e.id} 已存在`;
  }
  // 上面三个分支已经覆盖了 RepoErrorKind 的全部可能，
  // 所以这里不需要 assertNever —— TS 会推断出函数"所有路径都有返回"。
}
