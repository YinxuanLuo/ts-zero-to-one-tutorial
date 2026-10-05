// ============================================================================
// main.ts —— 入口
//
// 用法：
//   node project/main.ts                      -> 跑完整演示（无参数，零依赖）
//   node project/main.ts list                 -> 列出全部任务
//   node project/main.ts add <id> <标题>      -> 新建任务
//   node project/main.ts start <id>           -> todo  -> doing
//   node project/main.ts done <id>            -> doing -> done
//   node project/main.ts rm <id>              -> 删除
//   node project/main.ts stats                -> 各状态数量
//
// 对应第 09 章的模式：
//   1. Branded Type：命令行拿到的永远是 string，必须过 taskId() 才能变 TaskId
//   3. Result<T, E>：所有失败都靠返回值判断，不用 try/catch
//   7. satisfies：把命令表写成对象，同时让每个 handler 的签名被检查
// ============================================================================

import type { Repository } from './store.ts';
import { InMemoryRepository, RepoErrorKind, repoError } from './store.ts';
import { TaskService, describeTaskError } from './service.ts';
import type { TaskError } from './service.ts';
import type { Result, Task, TaskId } from './types.ts';
import { describeStatus, err, ok, taskId } from './types.ts';

// --- 组装依赖（依赖注入发生在这一行，而不是在 service 内部 new） -------------
const repo: Repository<Task> = new InMemoryRepository<Task>();
const service = new TaskService(repo);

// ---------------------------------------------------------------------------
// 输出小工具
// ---------------------------------------------------------------------------

function line(): void {
  console.log('-'.repeat(64));
}

function section(no: number, title: string): void {
  console.log('');
  line();
  console.log(`【${no}】${title}`);
  line();
}

/** 打印成功/失败的统一格式。注意这里用 r.ok 判别联合收窄，不用 catch。 */
function printResult(r: Result<Task, TaskError>, successLabel: string): void {
  if (r.ok) {
    console.log(`  [OK]   ${successLabel} -> ${r.value.id} ${describeStatus(r.value.status)}`);
  } else {
    console.log(`  [FAIL] ${successLabel} -> ${describeTaskError(r.error)}`);
  }
}

/** 命令行来的字符串必须先过构造器，才能变成 TaskId。 */
function toTaskId(raw: string | undefined): Result<TaskId, TaskError> {
  const r = taskId(raw ?? '');
  if (!r.ok) {
    return err({ kind: 'invalid-id', raw: raw ?? '', reason: r.error });
  }
  return ok(r.value);
}

/**
 * 【模式 3 的重点示范】两层 Result 嵌套时怎么优雅地写。
 *
 * TS 没有 Rust 的 `?` 运算符，所谓"优雅"其实就是：
 *   每一层都先判断 !ok 并 return，失败在类型上被排掉之后，后续代码直接取 .value。
 * 这叫"早返回 / 卫语句"，是 TS 里处理 Result 的标准姿势。
 */
function titleOfFirstTask(): string {
  const first = service.listTasks()[0];
  if (first === undefined) return '(仓库是空的)';

  const found = service.getTask(first.id);
  if (!found.ok) return `(取不到：${describeTaskError(found.error)})`;

  // 走到这里 found 已经被收窄成 Ok<Task>，.value 是安全的。
  return found.value.title;
}

// ---------------------------------------------------------------------------
// 完整演示：node project/main.ts（不带任何参数）
// ---------------------------------------------------------------------------

function demo(): void {
  console.log('类型安全任务管理器 · 完整演示');
  console.log('（本演示不读外部文件，所有数据都在内存里，随进程结束消失）');

  // ---- 1. 创建 ------------------------------------------------------------
  section(1, '创建任务：两处可预期的失败都走 Result');
  printResult(service.createTask('t-001', '通读第 09 章'), '建立 t-001');
  printResult(service.createTask('t-002', '手写 Result 工具函数'), '建立 t-002');
  printResult(service.createTask('t-003', '给项目补一组测试'), '建立 t-003');
  printResult(service.createTask('ab', '这个 ID 太短了'), '建立 ab（故意失败）');
  printResult(service.createTask('t-004', '   '), '建立 t-004 空标题（故意失败）');
  printResult(service.createTask('t-002', '重复的 ID'), '重复建立 t-002（故意失败）');

  // ---- 2. 状态机 ----------------------------------------------------------
  section(2, '状态机：todo -> doing -> done，非法转换被拦住');
  const idOf = (raw: string): TaskId => {
    const r = taskId(raw);
    // 演示代码里明确知道 ID 合法，但依然不写 `as TaskId`：
    // 断言会掩盖问题，显式失败更诚实。
    if (!r.ok) throw new Error(`演示数据写错了：${raw}`);
    return r.value;
  };

  const t1 = idOf('t-001');
  const t3 = idOf('t-003');

  printResult(service.startTask(t1), 't-001 开始');
  printResult(service.startTask(t1), 't-001 再开始一次（故意失败：doing -> doing 没开放）');
  printResult(service.finishTask(t1), 't-001 完成');
  printResult(service.finishTask(t1), 't-001 再完成一次（幂等，允许）');
  printResult(service.startTask(t1), 't-001 从 done 回到 doing（故意失败）');

  printResult(service.finishTask(t3), 't-003 直接 todo -> done（故意失败）');
  printResult(service.startTask(idOf('t-404')), 't-404 不存在（故意失败）');

  // ---- 3. 穷尽检查 --------------------------------------------------------
  section(3, '判别联合 + 穷尽检查：每个状态有自己的字段');
  for (const t of service.listTasks()) {
    console.log(`  ${t.id.padEnd(6)} [${t.status.kind.padEnd(5)}] ${t.title}`);
    console.log(`         ${describeStatus(t.status)}`);
  }

  // ---- 4. Result 组合子 ---------------------------------------------------
  section(4, 'Result 组合子：不写 try/catch 也能串流程');
  console.log(`  第一个任务的标题：${titleOfFirstTask()}`);
  console.log(`  仓库里还剩 ${repo.list().length} 个任务`);
  console.log('  写法要点：先处理失败分支并 return，后面就能直接取 .value —— 这就是');
  console.log('  TS 版本的 "?" 运算符（语言本身没有，只能靠早返回手工模拟）。');

  // ---- 5. satisfies 做命令表 ---------------------------------------------
  section(5, 'satisfies：命令表既是值也被类型检查');
  console.log(`  已注册命令：${Object.keys(commands).join(', ')}`);

  // ---- 6. 结构化类型做测试替身 -------------------------------------------
  section(6, '结构化类型：不用 mock 库也能造测试替身');
  fakeRepoTest();

  // ---- 7. 删除 ------------------------------------------------------------
  section(7, '删除 + 统计');
  printResult(service.removeTask(idOf('t-002')), '删除 t-002');
  printResult(service.removeTask(idOf('t-002')), '再删一次 t-002（故意失败）');
  const s = service.stats();
  console.log(`  统计：todo=${s.todo} doing=${s.doing} done=${s.done}`);
  console.log('');
  console.log('演示结束。');
}

// ---------------------------------------------------------------------------
// 命令表
// ---------------------------------------------------------------------------
//
// 【模式 7】satisfies 的实战用法。
//
// 如果写成 `const commands: Record<string, ...> = {...}`，键名写错了不会报错；
// 如果什么都不写，键名会被推成宽泛的 string，拼写错误也发现不了。
// 用 satisfies + 字面量键，就同时拿到"精确的键"和"检查过的值"。
type Handler = (args: readonly string[]) => Result<Task, TaskError>;

const commands = {
  add: (args: readonly string[]): Result<Task, TaskError> => {
    const id = toTaskId(args[0]);
    if (!id.ok) return err(id.error);
    return service.createTask(id.value, args.slice(1).join(' '));
  },
  start: (args: readonly string[]): Result<Task, TaskError> => {
    const id = toTaskId(args[0]);
    if (!id.ok) return err(id.error);
    return service.startTask(id.value);
  },
  done: (args: readonly string[]): Result<Task, TaskError> => {
    const id = toTaskId(args[0]);
    if (!id.ok) return err(id.error);
    return service.finishTask(id.value);
  },
  rm: (args: readonly string[]): Result<Task, TaskError> => {
    const id = toTaskId(args[0]);
    if (!id.ok) return err(id.error);
    return service.removeTask(id.value);
  },
} satisfies Record<string, Handler>;

/** 【模式 7 的收益】键取自 `keyof typeof commands`，不是随手的 string。 */
type CommandName = keyof typeof commands;

function isCommand(name: string): name is CommandName {
  return Object.hasOwn(commands, name);
}

// ---------------------------------------------------------------------------
// 结构化类型做测试替身
// ---------------------------------------------------------------------------
//
// 【模式 6】Repository<T> 是一个接口，TS 是结构化类型：
// 只要形状对得上就行，不需要 extends、不需要 mock 库。
// 这个对象字面量没有 Map、没有泛型类，但它就是一个合法的仓库。
function fakeRepoTest(): void {
  const calls: string[] = [];
  const fake: Repository<Task> = {
    find: (id) => {
      calls.push(`find(${id})`);
      return err(repoError(RepoErrorKind.NotFound, id));
    },
    list: () => {
      calls.push('list()');
      return [];
    },
    save: (item) => {
      calls.push(`save(${item.id})`);
      return ok(item);
    },
    upsert: (item) => {
      calls.push(`upsert(${item.id})`);
      return ok(item);
    },
    remove: (id) => {
      calls.push(`remove(${id})`);
      return err(repoError(RepoErrorKind.NotFound, id));
    },
  };

  const isolated = new TaskService(fake);
  const created = isolated.createTask('x-999', '用假仓库建的任务');
  printResult(created, '假仓库 createTask');
  console.log(`  假仓库记录到的调用：${calls.join(' -> ')}`);
  console.log('  注意：全程没有行为 mock 库，只有一个对象字面量。');
}

// ---------------------------------------------------------------------------
// 命令行入口
// ---------------------------------------------------------------------------

function cli(argv: readonly string[]): number {
  const [name, ...rest] = argv;

  if (name === undefined) {
    demo();
    return 0;
  }

  if (name === 'list') {
    for (const t of service.listTasks()) {
      console.log(`${t.id}\t${t.status.kind}\t${t.title}`);
    }
    return 0;
  }

  if (name === 'stats') {
    const s = service.stats();
    console.log(`todo=${s.todo} doing=${s.doing} done=${s.done}`);
    return 0;
  }

  // 这里体现 satisfies 的价值：isCommand 收窄之后，commands[name] 的类型
  // 精确到具体的那个函数，而不是 undefined。
  if (!isCommand(name)) {
    console.error(`未知命令：${name}`);
    console.error('可用命令：list / stats / add <id> <标题> / start <id> / done <id> / rm <id>');
    return 1;
  }

  const handler: Handler = commands[name];
  const result = handler(rest);

  if (result.ok) {
    console.log(`[OK]   ${result.value.id} ${describeStatus(result.value.status)}`);
    return 0;
  }
  console.error(`[FAIL] ${describeTaskError(result.error)}`);
  return 1;
}

// argv 前两项是 node 可执行文件路径和脚本路径，真正有用的参数从第 3 项开始。
process.exitCode = cli(process.argv.slice(2));
