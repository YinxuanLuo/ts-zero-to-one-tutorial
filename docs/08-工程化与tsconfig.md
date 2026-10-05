# 第 08 章 · 工程化与 tsconfig：读懂项目的工程底线

> 前面七章你在写代码，这一章你在**管代码**。读完它，你会获得一种能力：打开任何一个 TS 项目，看一眼 `tsconfig.json`，就知道"这个项目允许犯什么错、不允许犯什么错"。

配套文件：`examples/tsconfig.json`（参考工程主配置）、[tsconfig.strict-max.jsonc](<../examples/tsconfig.strict-max.jsonc>)、[tsconfig.bundler.jsonc](<../examples/tsconfig.bundler.jsonc>)、[tsconfig.build.jsonc](<../examples/tsconfig.build.jsonc>)。

---

## 8.1 tsconfig.json 到底是什么

**先人话**：它是**给 TypeScript 编译器看的一份设置文件**，回答三个问题 —— ① **哪些文件归你管**（`include` / `exclude` / `files`）；② **你按什么严格程度检查我**（`strict` 那一大串）；③ **检查完要不要吐 JS、吐到哪、吐成什么格式**（`noEmit` / `outDir` / `target` / `module`）。

**类比**：它是**装修开工前跟工长签的那份施工规范**——写着"承重墙不许动、电线必须 2.5 平方、验收按国标 XX"。工长（`tsc`）干活时全程对照这张纸。你改一行，全屋的验收标准就变了。

### 不写它会怎样

不写不是"不能用"，而是"用一套 2012 年设计的默认值"：

| 选项 | 内置默认值 | 人话 |
|---|---|---|
| `target` | `ES5` | 输出 2009 年的 JS 语法 |
| `module` | `CommonJS` | 产物用 `require()` |
| `strict` | `false` | **几乎所有安全检查全关** |
| `lib` | `["DOM","ES5","ScriptHost"]` | 只认识 ES5 的 API |
| `moduleResolution` | `node10` | 老式解析规则，不看 `exports` 字段 |

这套默认值**两个方向同时坑你**。**坑一：该报的不报。**

```ts
// 目录里没有 tsconfig.json
function double(n) { return n * 2; }
export const r = double('a');
```

```bash
npx tsc hello.ts     # 没有任何输出，编译成功
```

`n` 是隐式 `any`，`double('a')` 返回 `NaN`。这在 `strict` 下是 **TS7006**。**坑二：不该报的报，还改坏你的代码。**

```ts
const nums = [1, 2, 3];
const last = nums.at(-1);
```

```text
error TS2550: Property 'at' does not exist on type 'number[]'.
  Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
```

更糟的是 `target: ES5` 会**真的改写语义**：`const` 变 `var`（丢块级作用域）、箭头函数变 `function`（`this` 绑定变了）。**结论：不是"最好写一个"，而是"必须写好一个"。**

### 放在哪 / tsc 怎么找到它

① **你显式指定**：`npx tsc -p tsconfig.build.jsonc`（`-p` = project）；② **你什么都不说**：从当前目录往上逐级找 `tsconfig.json`，直到磁盘根目录；③ 还是找不到 → 报 **TS5081**：

```text
error TS5081: Cannot find a tsconfig.json file at the current directory: D:/some/where.
```

**放项目根目录。** 因为有一条关键规则：`include` / `exclude` / `files` 里的相对路径，是**相对于 tsconfig.json 自己所在的目录**解析的，不是相对于你敲命令的目录。所以在 `project/` 下敲 `npx tsc -p configs/tsconfig.json`，`include: ["src/**/*.ts"]` 找的是 `configs/src/`。**这是配 `extends` / 多配置时第一个要踩的坑。**

```bash
npx tsc --init          # 生成一份带全量注释的起点配置
npx tsc --noEmit        # 有配置 → 正常；没有 → TS5081
```

**一句话记住它：tsconfig.json 是项目根目录下的施工规范；不写它，tsc 会用 2012 年的宽松默认值——一边放过 `any`，一边把 `const` 改成 `var`。**

---

## 8.2 include / exclude / files / extends

**类比公司发通知**：`files` = **点名通知**（写谁谁必须看）；`include` = **部门范围通知**；`exclude` = **例外名单**；`extends` = **在集团通用文件上改两条**，不从头写。

**`files`：精确点名，不吃通配符。** 关键特性：**`files` 里的文件永远不会被 `exclude` 剔掉。**

```json
{ "files": ["src/index.ts", "src/cli.ts"] }
```

**`include`：范围勾选，吃通配符。**

```json
{ "include": ["src/**/*.ts", "tests/**/*.ts", "vite.config.ts"] }
```

| 写法 | 含义 |
|---|---|
| `*` | 匹配零个或多个字符，**不跨目录分隔符** |
| `?` | 匹配恰好一个字符 |
| `**/` | 匹配**任意层级**子目录（含零层） |

两个新手会懵的规则：① **不写扩展名时，TS 自动补上支持的扩展名**——`"src/**/*"` = `.ts` + `.tsx` + `.d.ts` 的合集；② **既不写 `files` 也不写 `include` 时，默认包含 tsconfig 所在目录下所有 TS 文件（递归，排除 `exclude`）**——这就是参考工程只写 `"include": ["**/*.ts"]` 就够用的原因。

**`exclude`：只从 include 结果里做减法。** 不写时的默认值（外加 `outDir`）：

```json
["node_modules", "bower_components", "jspm_packages"]
```

两条反直觉但极重要：

**① `exclude` 管不住"被 import 进来的文件"。**

```ts
// src/main.ts ← 在 include 里
import { helper } from './internal/secret.ts';
//                        ↑ 就算 internal/ 写在 exclude 里，它照样进编译
```

`include` / `files` 决定的是**根文件**；一旦被根文件 `import`，它就被拉进程序了。想真正隔离，得用**独立的 tsconfig**（8.6 节 `tsconfig.build.jsonc` 的用途）。

**② `files` 和 `include` 是并集，`exclude` 只对 `include` 那部分做减法。**

```text
最终文件集合 = files ∪ (include − exclude)
```

**`extends`：配置的继承。** 三条规则：① **相对路径按"子配置所在目录"解析**——所以 `packages/api/tsconfig.json` 里要写 `"../../tsconfig.base.json"`；② **裸路径（不带 `./`）按 npm 包解析**——`"@tsconfig/node22/tsconfig.json"` 去 `node_modules` 找，社区有现成的 `@tsconfig/strictest`；③ **覆盖是"整块替换"，不是"深度合并"**：

```jsonc
// base
{ "compilerOptions": { "paths": { "@/*": ["./src/*"], "#/*": ["./internal/*"] } } }
// child
{ "extends": "./base.json", "compilerOptions": { "paths": { "@/*": ["./app/*"] } } }
// 结果：paths 只剩 { "@/*": ["./app/*"] }，"#/*" 没了
```

`include` / `exclude` / `files` 也一样：一旦在子配置出现，就**完全覆盖**父配置。

**一句话记住它：`files ∪ (include − exclude)` 是最终文件集；`extends` 是整块替换不是深度合并；`exclude` 拦不住被 import 的文件。**

---

## 8.3 ★ 排查神器：`tsc --showConfig`

遇到"配置到底生效了没有"，**第一条命令就是它**：`npx tsc --showConfig`。它打印**合并 + 补默认值之后**的最终配置。下面是参考工程的真实输出：

```json
{
  "compilerOptions": {
    "target": "es2022", "lib": ["es2023"],
    "module": "nodenext", "moduleResolution": "nodenext",
    "strict": true, "noImplicitOverride": true, "noFallthroughCasesInSwitch": true,
    "noEmit": true, "allowImportingTsExtensions": true, "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true, "verbatimModuleSyntax": true,
    "moduleDetection": "force", "isolatedModules": true,
    "esModuleInterop": true, "allowSyntheticDefaultImports": true,
    "resolvePackageJsonExports": true, "resolvePackageJsonImports": true,
    "resolveJsonModule": true, "preserveConstEnums": true,
    "useDefineForClassFields": true,
    "noImplicitAny": true, "noImplicitThis": true, "strictNullChecks": true,
    "strictFunctionTypes": true, "strictBindCallApply": true,
    "strictPropertyInitialization": true, "strictBuiltinIteratorReturn": true,
    "alwaysStrict": true, "useUnknownInCatchVariables": true
  },
  "files": ["./00-enum-probe.ts", "./00-import-probe.ts", "./00-lib.ts", "./00-smoke.ts"],
  "include": ["**/*.ts"]
}
```

**三个"醍醐灌顶"级别的信息：**

**信息一：`strict: true` 在下面"长出了" 9 个开关**——`noImplicitAny` / `noImplicitThis` / `strictNullChecks` / `strictFunctionTypes` / `strictBindCallApply` / `strictPropertyInitialization` / `alwaysStrict` / `useUnknownInCatchVariables` / `strictBuiltinIteratorReturn`。**不在这个列表里的"隐藏关卡"，一个都没开**（8.4.4 节专门讲这批）。

**信息二：你只开了 3 个开关，却"白拿"了一堆默认值**——`useDefineForClassFields: true` 是 **`target: ES2022` 带来的**，`isolatedModules: true` 是 **`verbatimModuleSyntax: true` 带来的**。这就是"照抄别人的 `target`"很危险的原因：你抄的是 `target`，连带抄走的是一堆行为差异。

**信息三：`files` 是"最终名单"，`include` 只是"你当初写的规则"。** 想知道"我到底编了哪些文件"，看 `files`，别猜。

```bash
npx tsc -p tsconfig.build.jsonc --showConfig    # 指定配置文件
npx tsc -p tsconfig.json src/index.ts           # ⚠️ -p 不能和文件名混用
# error TS5042: Option 'project' cannot be mixed with source files on a command line.
```

**排查顺序**：① 找不到某个类型 → 看 `lib` / `types`；② 报 `document` 不存在（TS2584）→ 看 `lib` 有没有 `DOM`；③ 满屏 `any` → 看 `strict` 是否真为 `true`；④ 报错在你以为不该编的文件里 → 看 `files`。

**一句话记住它：`--showConfig` 打印的是"合并 + 补默认值"之后的最终规范，它是你和 tsc 之间唯一没有信息差的沟通渠道。**

---

## 8.4 逐项讲透关键编译选项

### 8.4.1 `target` 与 `lib`

| 选项 | 管什么 | 大白话 |
|---|---|---|
| `target` | 输出**什么版本的 JS 语法** | 要不要把 `async/await`、`class`、可选链**改写成**更老的语法？ |
| `lib` | 允许你**调用哪些内置 API** | 我写字时可以翻哪本字典？ |

**类比**：`target` 是**印刷厂**（管成品长什么样），`lib` 是**你手里的字典**（查不到的词不能写）。印刷厂的档位会顺带决定你拿到哪本字典，**但你可以自己换字典**。

**不开会怎样**（默认 `target: ES5`）：

```ts
const nums: number[] = [1, 2, 3];
export const last = nums.at(-1);
```

```text
error TS2550: Property 'at' does not exist on type 'number[]'.
  Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
```

```ts
// lib: ["ES2023"] ✅
export const last: number | undefined = nums.at(-1);
```

**`target` ↔ ECMAScript 对照表**：

| `target` | 对应标准 | 这一档的关键语法 |
|---|---|---|
| `ES3` | ES3（1999） | 只有 `var` / `function`。TS 5.x 已**不支持** |
| `ES5` | ES5（2009） | `Array.isArray`。**tsc 内置默认值** |
| `ES2015`/`ES6` | ES2015 | `let`/`const`、箭头函数、`class`、`Promise`、`Map`/`Set`、解构、模块 |
| `ES2016` | ES2016 | `Array.prototype.includes`、`**` |
| `ES2017` | ES2017 | `async`/`await`、`Object.entries`/`values` |
| `ES2018` | ES2018 | 对象展开 `{...a}`、`Promise.finally`、异步迭代 |
| `ES2019` | ES2019 | `Array.flat`、`Object.fromEntries`、可选 catch 绑定 |
| `ES2020` | ES2020 | **可选链 `?.`**、**空值合并 `??`**、`BigInt`、`import()`、`globalThis` |
| `ES2021` | ES2021 | `String.replaceAll`、`Promise.any`、逻辑赋值 `??=` |
| `ES2022` | ES2022 | **顶层 await**、`Array.prototype.at`、`Object.hasOwn`、class 字段、`Error.cause`、`#private` |
| `ES2023` | ES2023 | `findLast`/`findLastIndex`、Hashbang |
| `ES2024` | ES2024 | `Object.groupBy`、`Promise.withResolvers` |
| `ESNext` | 最新草稿 | 含未定稿提案。**别在生产用** |

**`lib` 常用取值**：`ES2023`（语言内置 API）、`DOM`（`document`/`window`/`fetch`）、`DOM.Iterable`（`NodeList` 支持 `for...of`）、`WebWorker`（与 `DOM` 互斥）、`ScriptHost`（上古 WSH，**删掉**）。

**重要澄清：Node 的全局变量（`console`、`process`、`Buffer`）不在 `lib` 里**，它们由 `@types/node` 提供；所以 Node 项目的配方就是 `lib: ["ES2023"]` + 装 `@types/node`。反过来，参考工程用了 `lib: ["ES2023"]`，所以写 `document` 会报：

```text
error TS2584: Cannot find name 'document'. Do you need to change your target library?
  Try changing the 'lib' compiler option to include 'dom'.
```

这不是 bug，是**故意的**——"我的代码不该碰 DOM"这条约束被编译器强制执行了。

**推荐值 + 为什么**：

```jsonc
{ "target": "ES2022", "lib": ["ES2023"] }
// 前端额外加： "lib": ["ES2023", "DOM", "DOM.Iterable"]
```

① Node 24 原生支持到 ES2024+，`ES2022` 是"能被所有现代环境直接跑"的安全线；② 它是现代工具链的事实标准，和 Vite / esbuild 的默认目标对齐，才不会"tsc 说行、esbuild 说我不认"；③ 再往上（`ES2024`/`ESNext`）可能遇到"`lib` 给了类型但运行时还没有"→ 编译通过、运行崩；④ **`target: ES2022` 附带把 `useDefineForClassFields` 打开**，与 Vite / esbuild 的类字段行为一致，调回 `ES2018` 会悄悄改变类字段初始化语义。

**一句话记住它：`target` 决定产物长什么样，`lib` 决定你能调用什么；`target: ES2022` + `lib: ["ES2023"]` 是 2025 年的稳妥起点。**

---

### 8.4.2 `module` 与 `moduleResolution`

**`module`**：输出的 JS 用哪种模块系统（`import/export` 原样保留？还是翻译成 `require()`？）。**`moduleResolution`**：tsc 拿到 `import './utils'` 时去哪儿找那个文件。**类比**：`module` 是**你写信用哪种语言**，`moduleResolution` 是**邮局按什么规则投递**，两者必须**配对**。

| `module` | `moduleResolution` | 适用场景 | 关键行为 |
|---|---|---|---|
| `NodeNext` | `NodeNext` | Node 服务 / CLI / 库 | 严格按 Node ESM 规则：**相对导入必须写全后缀**（`./a.js`） |
| `ESNext` | `Bundler` | 前端 Vite / React / Vue | 允许省略后缀（`./App`），读 `package.json` 的 `exports` |
| `CommonJS` | `Node10` | 维护老项目 | 产物是 `require()`；不认 `exports` 字段 |
| `Preserve` | `Bundler` | 混合项目 / 库作者 | 保留你写的形态，不擅自转换 |

**为什么 Node 服务用 `NodeNext`**：Node 的 ESM 加载器**按真实文件路径找文件，不做任何猜测**。

```ts
// module: NodeNext
import { tag } from './utils';
```

```text
error TS2835: Relative import paths need explicit file extensions in ECMAScript imports
  when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './utils.js'?
```

**注意它建议 `./utils.js` 而不是 `./utils.ts`——这不是笔误**：Node 运行时看到的是编译后的 `utils.js`。

```ts
import { tag } from './utils.js';   // ✅ 源码写 .js，指的是编译产物
```

**`allowImportingTsExtensions`**：允许写 `./utils.ts`，方便 `node --experimental-strip-types` 直接跑源码，**但它要求 `noEmit: true`**：

```text
error TS5096: Option 'allowImportingTsExtensions' can only be used when either
  'noEmit' or 'emitDeclarationOnly' is set.
```

**为什么前端用 `Bundler`**：真正解析导入的是 **Vite / Rollup**，不是 Node，而打包器的规则是"我帮你找，你随便写"：

```ts
// module: ESNext + moduleResolution: Bundler
import { Button } from './components/Button';   // ✅ 不用后缀
import { Button } from '@/components/Button';   // ✅ 路径别名
```

硬在前端用 `NodeNext` 会被 `TS2835` 刷屏——**因为工具链的规矩本来就不是 Node 的规矩**；用 `Bundler` 就是告诉 tsc："你按打包器的规矩来查。"

**一个很少人讲的真相**：`module` 还影响"报错严不严"。`NodeNext` 会额外启用一批只有 ESM 才有的错误（导入纯 CJS 包却解构命名导出、`import = require` 用在 ESM 文件里、`export =` 和 `export default` 混用）。这是好事：把"打包能过、Node 跑不起来"提前到编译期。

**配错了会怎样（真实报错）**：

```text
# { "module": "NodeNext", "moduleResolution": "Bundler" }
error TS5095: Option 'bundler' can only be used when 'module' is set to 'preserve' or to 'es2015' or later.
error TS5109: Option 'moduleResolution' must be set to 'NodeNext' (or left unspecified)
  when option 'module' is set to 'NodeNext'.

# { "module": "Preserve", "moduleResolution": "NodeNext" }
error TS5110: Option 'module' must be set to 'NodeNext' when option 'moduleResolution'
  is set to 'NodeNext'.
```

**没有 `"module": "Bundler"` 这个值**，写错了会看到合法值列表：

```text
error TS6046: Argument for '--module' option must be: 'none', 'commonjs', 'amd', 'system',
  'umd', 'es6', 'es2015', 'es2020', 'es2022', 'esnext', 'node16', 'node18', 'node20',
  'nodenext', 'preserve'.
```

**`"type": "module"` 与它的联动**：`package.json` 的 `"type"` 决定 **`.js` 文件按 ESM 还是 CJS 解释**，`NodeNext` 会读它来决定你的 `.ts` 编译后是 ESM 还是 CJS。

| `package.json` 的 `type` | 文件后缀 | tsc 认为它是 |
|---|---|---|
| `"type": "module"` | `.ts` / `.js` | ESM |
| `"type": "module"` | `.cts` / `.cjs` | CommonJS |
| 不写（默认 commonjs） | `.ts` / `.js` | **CommonJS** |
| 不写 | `.mts` / `.mjs` | ESM |

**这就是"我写的是 `import`，产物怎么变成 `require`"的答案**：`package.json` 里没有 `"type": "module"`。

**推荐值**：

```jsonc
// Node 服务 / CLI / 库（package.json 同时写 "type": "module"）
{ "module": "NodeNext", "moduleResolution": "NodeNext" }
// 前端
{ "module": "ESNext", "moduleResolution": "Bundler" }
```

**一句话记住它：`module` 管产物用什么模块系统，`moduleResolution` 管 import 怎么找文件；Node 用 `NodeNext`（必须写 `.js` 后缀），前端用 `Bundler`（可以省略后缀）。**

---

### 8.4.3 `strict`：一个总开关和它下面的 9 个开关

**类比**：`strict` 是**健身房年卡**——办卡等于同时买了所有项目；你也可以单独退掉某一项（`"strictNullChecks": false`），但那等于白办卡。**为什么要有总开关**：让用户一个个开关去查文档、理解"这个防什么 bug"，没人会做。

**（1）`strictNullChecks` —— 重头戏。** 打开后 `null` 和 `undefined` **不再是"任何类型都能装的值"，而是两个独立的类型**。

```ts
function findUser(id: number): { name: string } | undefined {
  return id === 1 ? { name: 'ann' } : undefined;
}
export function report(id: number): string {
  const u = findUser(id);
  return u.name.toUpperCase();
}
```

`strictNullChecks: true`（推荐值）报 **`error TS18048: 'u' is possibly 'undefined'.`**；`false` 则**没有任何输出、编译成功**，然后运行时 `TypeError: Cannot read properties of undefined (reading 'name')`。**这就是全部意义**：一个开关，把"上线后凌晨三点的 TypeError"变成"敲代码时的一行红字"。修法：

```ts
export function report(id: number): string {
  const u = findUser(id);
  if (!u) return '未知用户';       // 这里之后 u 一定是 { name: string }
  return u.name.toUpperCase();
}
// 或者：findUser(id)?.name.toUpperCase() ?? '未知用户'
```

**为什么这么设计：Tony Hoare 的"十亿美元错误"**。1965 年，**Tony Hoare** 设计 ALGOL W 时为了让"没有值"有个统一表示，引入了**空引用（null reference）**，这个设计后来被 Java、C、C++、C#、JavaScript 全套抄走。2009 年他在 QCon 上说：

> "I call it my billion-dollar mistake."（我把它称为我的十亿美元错误。）

为什么值十亿美元？因为**空引用的类型和普通值一模一样**。你声明 `User u`，编译器就认为 `u` 一定是个 `User`；至于它可能是 `null`——**类型系统完全不知情**。于是每一处解引用都是潜在崩溃点，编译器却帮不上忙。TypeScript 的选择是：**把 `null`/`undefined` 从"所有类型的成员"里踢出去**，从此 `{ name: string }` 真的表示"一定有 name"，"可能没有"必须显式写出来。**一个副作用**：关掉它时 `undefined` 会被吸收进其他类型并污染推断——`let x = undefined` 的类型会是 `any`，因为"undefined 类型"根本不存在。

**一句话记住它：`strictNullChecks` 把"十亿美元错误"从运行时搬到编译期；关掉它，你写的 `?:` 和 `??` 全是自我安慰。**

**（2）`noImplicitAny` —— 不许有"隐形的 any"。**

```ts
export function double(n) { return n * 2; }
export const result: number = double('a');   // 编译通过！
```

`noImplicitAny: true` 时报 **`error TS7006: Parameter 'n' implicitly has an 'any' type.`**。`n` 是 `any` → 返回 `any` → `double('a')` 是 `NaN` → `NaN` 像病毒一样传播到用户眼前；正确写法就是加类型注解 `(n: number): number`。**为什么叫 "implicit"**：它只拦"你什么都没说、编译器自己决定是 any"的情况；你**显式**写 `: any` 是允许的——因为那是一个**你的决定**，能被 code review 看见和质疑。

**一句话记住它：`noImplicitAny` 不禁止 `any`，它只禁止"没人做主的 `any`"。**

**（3）`strictFunctionTypes` —— 函数参数是"逆变"的。** 一句话：**"能处理更广输入的函数"可以替代"只需处理更窄输入的函数"；反过来不行。**
**类比招聘**：岗位要求"会修**所有**家电"（输入宽）；把只会修空调的人塞进来 → 明天来了洗衣机他就傻眼。反过来，"什么都会修"的人去应聘"只修空调"的岗位，可以。**不开会怎样？** 默认（`false`）是**双变**，两个方向都放行：

```ts
type Handler = (input: string | Date) => void;
function onEvent(h: Handler): void { h('hello'); }   // 框架保证：一定会用字符串调用你
const dateOnly = (d: Date): void => { void d.toISOString(); };
onEvent(dateOnly);   // ❌ 这里应该报错
```

`strictFunctionTypes: true`（推荐值）报：

```text
error TS2345: Argument of type '(d: Date) => void' is not assignable to parameter of type 'Handler'.
  Types of parameters 'd' and 'input' are incompatible.
    Type 'string | Date' is not assignable to type 'Date'.
      Type 'string' is not assignable to type 'Date'.
```

`false` 时**无任何输出**；运行时框架调用 `h('hello')` → `'hello'.toISOString is not a function` → 崩。**报错怎么读**：目标函数（`Handler`）会用 `string | Date` 来调用，你给的函数只接受 `Date`，而 `string | Date` 不保证是 `Date`，所以不兼容。修法是**把参数放宽到和调用方一致**（`(input: string | Date)` 里用 `instanceof` 分支），或者**在函数体里先做守卫**（`if (!(input instanceof Date)) return;`）。

> ⚠️ **历史例外（高频面试点）**：它**只作用于"函数类型属性"和"函数类型变量"，不作用于"方法语法"**。`interface CompareA { compare(a: Animal, b: Animal): boolean }` 仍然双变，而 `compare: (a: Dog, b: Dog) => boolean` 会检查逆变。为什么留这个口子？因为数组的 `push`、`indexOf` 都是方法语法；严格逆变会让 `string[]` 无法赋给 `(string|number)[]`，打碎海量现存代码（第 00 章的"哲学四：宁可不健全，也不能难用"）。**想被严格检查就用属性写法。**

**一句话记住它：参数越宽的函数越"能耐"；但方法语法它管不着。**

**（4）`strictBindCallApply` —— `bind` / `call` / `apply` 也要检查参数。**

```ts
export function greet(name: string, age: number): string { return name + age; }
export const bound = greet.bind(null, 1);            // 第一个参数应该是 string
export const called = greet.call(null, 'ann');       // 少传了一个
export const applied = greet.apply(null, ['ann']);   // 数组元素类型/长度都不对
```

开启后三条全报：

```text
error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
error TS2554: Expected 3 arguments, but got 2.
error TS2345: Argument of type '[string]' is not assignable to parameter of type '[name: string, age: number]'.
  Source has 1 element(s) but target requires 2.
```

`false` 时**无任何输出**。**为什么值钱**：`greet.call(null, 'ann')` 里那个 `null` 是 `this`，很容易看漏；开了它编译器帮你数参数。**注意它只管类型**，运行时 `this` 实际绑到哪儿 TS 不管。

**一句话记住它：它让 `call`/`apply`/`bind` 不再是一块"类型检查的飞地"。**

**（5）`strictPropertyInitialization` —— 类属性必须在构造函数里落地。**

```ts
export class User {
  name: string;
  age: number;                        // 忘了赋值
  constructor(name: string) { this.name = name; }
}
export const age: number = new User('ann').age;    // 编译通过
```

开启后报 **`error TS2564: Property 'age' has no initializer and is not definitely assigned in the constructor.`**；`false` 时**无任何输出**，运行时 `age` 是 `undefined`，但类型说是 `number`——**类型在骗人**。四条出路：① 给默认值 `age = 0`；② 构造函数里赋值；③ 写 `age!: number`（**非空断言 = 你向编译器做的承诺**，DI 忘了注入类型救不了你）；④ 声明成可选 `age?: number`。**为什么这么设计**：类字段初始化顺序在 JS 里很不直观（字段初始化 → 构造函数体），TS 的立场是**能静态确认的必须确认，确认不了的必须由你用 `!` 显式签字**。

**一句话记住它：它逼你在"给默认值 / 构造函数里赋值 / 写 `!` 认账"三条路里选一条。**

**（6）`noImplicitThis` —— `this` 不许是隐式 `any`。**

```ts
const counter = { count: 0, inc() { return this.typo; } };   // typo 根本不存在
export const r = counter.inc();
```

开启后报：

```text
error TS7023: 'inc' implicitly has return type 'any' because it does not have a return type
  annotation and is referenced directly or indirectly in one of its return expressions.
error TS2339: Property 'typo' does not exist on type '{ count: number; inc(): any; }'.
```

`false` 时**无任何输出**。**注意 TS7023 多贴心**：它不说"`this` 是 any"，而是说"我推不出返回类型，因为你的返回表达式依赖一个我搞不清的东西"——**以后看到 "implicitly has return type 'any'"，第一个该怀疑的就是它内部碰了隐式 `this` 或者递归**。修法有两种：显式 `this` 参数（`export function inc(this: { count: number }): number`），或者用对象方法让 TS 从对象字面量推断 `this`。

**一句话记住它：`noImplicitThis` 让 `this` 从"运行时的谜"变成"编译期的类型"。**

**（7）`useUnknownInCatchVariables` —— `catch` 到的必须是 `unknown`。**

```ts
export function parse(text: string): unknown {
  try { return JSON.parse(text); } catch (e) { return e.message; }
}
```

开启后报 **`error TS18046: 'e' is of type 'unknown'.`**，`false` 时**无任何输出**。**为什么必须是 `unknown`**：JS 里 `catch` **能捕获任何东西**，不只是 `Error`——`throw 'a string'` 合法（`e.message` 是 `undefined`）、`throw { code: 500 }` 合法（正确的是 `e.code`），只有 `JSON.parse` 这类才真的是 `Error` 实例。写 `e.message` 就**假设了"抛出来的必定是 Error 实例"**，这个假设在 JS 里不成立。所以 TS 说：既然我无法知道它是什么，它就不是 `any`（"什么都行"=不检查），而是 `unknown`（"我还不知道，你得先证明"）。修法：`catch (e) { if (e instanceof Error) return e.message; return String(e); }`。

**`any` vs `unknown`（面试必考）**：`any` 能随便赋给别的类型、能随便读属性和调用（是个**黑洞**，双向吞掉检查）；`unknown` 两者都**必须先收窄**，所以是安全的。

**一句话记住它：`any` 是"我不检查"，`unknown` 是"你先证明"。**

**（8）`alwaysStrict`。** 严格模式防的是这些"静默失败"：`undeclaredVar = 1` 意外创建全局变量、`delete Object.prototype` 静默返回 false、`NaN = 5` 静默失败。**但要给你一个诚实的说明**（很多教程含糊过去了）：**ESM 文件天然就是严格模式**——我实测过，`target: ES2022` + `module: CommonJS` 时 `alwaysStrict` 开和关，产物**都有** `"use strict";`。所以它今天只影响**非模块的脚本文件**，而 `strict: true` 已经包含它，**你不需要单独写**。

**一句话记住它：`alwaysStrict` 是套餐里的附赠品，现代 ESM 项目里它本来就成立。**

**（9）`strictBuiltinIteratorReturn`。** TS 5.6 新增，也被 `strict` 包含。它让 `Map`、`Set`、生成器等**内置迭代器**在"迭代结束时"的返回类型是 `undefined` 而不是 `any`。你几乎不需要单独关心，但**看到 `[Symbol.iterator]()` 相关的类型报错时，它是嫌疑对象之一**。

**`strict` 全家福总表**：

| 开关 | 一句话人话 | 关掉会漏掉什么 | 典型报错 |
|---|---|---|---|
| `strictNullChecks` | `null`/`undefined` 是独立类型 | 空值崩溃 | `TS18048` |
| `noImplicitAny` | 不许隐形的 `any` | `any` 病毒、NaN 传播 | `TS7006` |
| `strictFunctionTypes` | 函数参数逆变检查 | 回调参数写窄 → 运行时炸 | `TS2345` |
| `strictBindCallApply` | `call`/`apply`/`bind` 检查参数 | 参数个数/类型错位 | `TS2554` |
| `strictPropertyInitialization` | 类属性必须落地 | `undefined` 骗成 `number` | `TS2564` |
| `noImplicitThis` | `this` 不许是隐式 `any` | 回调里 `this` 丢失 | `TS7023` |
| `useUnknownInCatchVariables` | `catch` 变量是 `unknown` | 假设异常是 Error 实例 | `TS18046` |
| `alwaysStrict` | 严格模式 + `"use strict"` | 静默失败的写操作 | — |
| `strictBuiltinIteratorReturn` | 内置迭代器 `return` 是 `undefined` | 迭代器返回值类型不准 | `TS2322` |

推荐值就是 `{ "strict": true }`。**不要做的事**：单独关掉其中某一个，你会在 code review 里被问"为什么"；**唯一可商量的例外**是从巨大 JS 项目迁移时可**临时**先关 `strictNullChecks`，但必须排进计划还债。

**一句话记住它：`strict: true` 是 TS 的安全模式，它包含的 9 个开关每一个都对应一类真实事故，别拆开用。**

---

### 8.4.4 隐藏关卡：不在 `strict` 里但强烈推荐

`strict: true` 只覆盖"语言最基本的安全"。下面这批**不开就不管**，而它们才是真正减少线上事故的。

**（1）`noUncheckedIndexedAccess` —— 防 undefined 崩溃神器。** 所有"通过下标/键取值"的地方，类型自动加 `| undefined`。**类比**：把"仓库货架"改成"**可能为空的货架**"——以前你说"我要 3 号货架的东西"，系统就当它一定在；现在系统说"你先确认一下"。

```ts
export const nums: number[] = [1, 2, 3];
export const first: number = nums[0];        // 编译通过
export const doubled: number = first * 2;

export const counts: Record<string, number> = {};
export const n: number = counts['a'];        // 编译通过
export const fixed: string = n.toFixed(2);   // 运行时 TypeError
```

数组为空 → `nums[0]` 是 `undefined` → `undefined * 2` 是 `NaN`；对象没那个键 → `.toFixed()` **直接崩**。开启后上面两处赋值各报一次：

```text
error TS2322: Type 'number | undefined' is not assignable to type 'number'.
  Type 'undefined' is not assignable to type 'number'.
```

**嵌套下标也管**：`grid[0][0]` 会报

```text
error TS2532: Object is possibly 'undefined'.
```

（这里是 `TS2532` 而不是 `TS18048`——两个码都表示"可能 undefined"，`TS2532` 用在"你对一个可能 undefined 的东西继续操作"的场景。）

**它带来的写法变化（别被劝退）**：`if (first !== undefined) ...` 先判断（最清晰）；`nums[0] ?? 0` 给默认值；`nums[0]!` 断言"这里一定有"（⚠️ 是你对编译器的承诺）；循环里嫌烦就用 `for...of`（元素类型不带 undefined）。
> **`Object.keys` 的旁注**：开了它之后 `obj[key]`（`key: string`）也会变 `undefined`，常见解法是 `const keys = Object.keys(config) as (keyof typeof config)[];`

**诚实的代价与收益**：代价是老项目一打开会瞬间多出几十到几百个 `TS2322` / `TS2532`，循环里 `arr[i]` 全要处理 undefined；收益是所有"数组越界 / 键不存在"的线上崩溃在编译期被拦下，并且逼你在**取值那一刻**就想清楚"没有怎么办"。**建议：新项目必开**；老项目可以晚点开，但别永远不开——它是投入产出比最高的隐藏关卡。

**一句话记住它：它承认"下标访问可能拿不到东西"这个事实——让你多打几个字，换掉一整类 undefined 崩溃。**

**（2）`exactOptionalPropertyTypes`。** 它逼你区分：`timeout?: number` = 这个字段**可以不出现**；`timeout?: number | undefined` = 字段可以出现，值可以是 `undefined`。**类比填表**：前者是"这一栏可以不填（填了就必须是数字）"，后者是"这一栏可以填，也可以填上'无'"。不开时 `{ timeout: undefined }` 编译通过，开启后：

```text
error TS2375: Type '{ timeout: undefined; }' is not assignable to type 'Opts'
  with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types
  of the target's properties.
  Types of property 'timeout' are incompatible.
    Type 'undefined' is not assignable to type 'number'.
```

传参时报的是 `TS2379`（文案相同，只是开头是 "Argument of type"）。**真正的价值场景：PATCH 请求和部分更新**——不开这个开关时，`{ name: undefined }` 到底是"改成 undefined"还是"别改这个字段"分不清；开了之后前者直接报错，你被迫想清楚，或者显式写成 `name?: string | undefined`。**代价**：和第三方库的类型定义容易打架（很多库写 `foo?: T` 但实现里会传 `undefined`），局部 `@ts-expect-error` 或者晚点再开。

**一句话记住它：它让"字段不存在"和"字段是 undefined"分开——写 PATCH 类接口时它是救命的。**

**（3）`noImplicitOverride`。** **类比**：公司制度——你"修订"了集团文件，必须在页眉盖"本文件修订自集团 V3.2"的章；不盖章的后果是集团改了原文件后你的修订**悄悄失效**，而没人知道。

```ts
export class Base { greet(): void { void 0; } }
export class Child extends Base {
  greet(): void { void 1; }      // 你以为你在重写
}
```

```text
error TS4114: This member must have an 'override' modifier because it overrides
  a member in the base class 'Base'.
```

修法是写 `override greet(): void` 明确表态。**它防的真实事故**：父类把 `greet` 改名成 `sayHello`——不开这个开关时，子类的 `greet` **静默变成"新增方法"**，你的定制逻辑再也不会被父类内部调用，编译毫无提示；开了之后 `override greet()` 立刻报错："父类里没有 `greet` 可以重写。"**这就是参考工程单独打开它的原因。**

**一句话记住它：没这个章，父类改名时你会静默丢掉定制逻辑。**

**（4）`noFallthroughCasesInSwitch`。** **类比**：楼梯上的护栏——`break` 就是那根护栏，没有它你会从三楼一路滑到一楼。

```ts
case 'a': return 'A';
case 'b': void 'b';        // 忘了 break / return
case 'c': return 'C';
```

```text
error TS7029: Fallthrough case in switch.
```

**注意：TS 不拦"空的 case 落下来"，只拦"有语句的 case 落下来"**——空 case 落下来是**明确的意图**（`case 'pending': case 'processing': return '进行中';` 共用分支，不报错）。

**一句话记住它：空的 case 落下来算你有意，有语句还落下来就是忘写 `break`。**

**（5）`noPropertyAccessFromIndexSignature`。** **类比快递柜**：`obj.field` 是**你家门牌**（确定的、唯一的地址），`obj['key']` 是**快递柜任意一格**（谁都能用，可能是空的）——用点号访问快递柜会让你**误以为那是你家门牌**。

```ts
export const user: Record<string, number> = { a: 1 };
export const v = user.a;         // 不开时：编译通过
export const w = user.nothing;   // 也通过！运行时 undefined
```

```text
error TS4111: Property 'a' comes from an index signature, so it must be accessed with ['a'].
```

**它解决了什么**：`obj.key` 看起来像在访问**已知的、有约束的字段**，但实际是"任意字符串键"，拼错一个字母编译器**不可能知道**；用了 `[]`，读代码的人一眼就知道"这里键是动态的，别指望拼写检查"。**和 `noUncheckedIndexedAccess` 是绝配**：一个管"写法要显眼"，一个管"类型要带 undefined"。

**一句话记住它：点号访问像是"已知字段"，方括号访问才是"任意键"。**

**（6）`verbatimModuleSyntax`。** **类比报关单**：`import type` = 申报"样品，不进关"（编译器删掉它）；`import` = 申报"正式货物，保留"（原样输出）。

```ts
import { User } from './models';       // User 只是个类型
```

```text
error TS1484: 'User' is a type and must be imported using a type-only import
  when 'verbatimModuleSyntax' is enabled.
```

修法是 `import type { User } from './models'`，或者行内标记 `import { type User, helper } from './models'`。**为什么这是打包器时代的刚需**：在它之前 TS 会**猜**"哪些 import 名字是类型"，然后把纯类型的部分自动删掉——**问题是 esbuild / swc / Vite 不做类型分析，它不会猜**。于是 `tsc` 说"`User` 是类型，我把这行删了"（产物干净），`esbuild` 说"我不认识它是类型还是值，**原样保留**"→ 运行时 `SyntaxError: The requested module does not provide an export named 'User'`。`verbatimModuleSyntax: true` 的解决办法很直接：**不猜了**——你写 `import type` 我就删，写 `import` 我就留，这样 tsc 和打包器行为**完全一致**。**一个已知限制**：它和 `module: CommonJS` 配合不好，看到 `TS1286: ESM syntax is not allowed in a CommonJS module when 'verbatimModuleSyntax' is enabled` 就改 `module` 或者先别开。

**一句话记住它：它让类型导入和值导入在源码里就分清楚——因为打包器不会替你猜，猜错就是运行时崩溃。**

**（7）`isolatedModules`。** **类比流水线质检**：`tsc` 是**总质检员**（看得见整个工厂），esbuild / swc 是**工位质检员**（只看得见面前那一个零件）；`isolatedModules` 的作用是**禁止使用"必须看到别的文件才能判断"的语法**。

```ts
export { User } from './models';       // User 是个类型
```

```text
error TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'.
```

修法是 `export type { User } from './models'`。**为什么打包器需要它**：esbuild 一次只转译一个文件（这正是它快的原因），光看 `export { User } from './models'` 它**无法知道 `User` 是类型还是值**——是类型就必须删，是值就必须留。它猜不出来，所以规则是**你必须写成 `export type`，让它不必猜**。**注意**：TS 5.9 里 `verbatimModuleSyntax` 会**自动打开** `isolatedModules`（`--showConfig` 输出里能看到它是白拿的）。

**一句话记住它：它让每个文件都能被"单独转译"，这是 Vite / esbuild / swc 能一边飞快一边正确的前提。**

---

### 8.4.5 `skipLibCheck`

**人话**：跳过 `node_modules` 里所有 `.d.ts` 文件的**内部**类型检查。**类比验房**：`false` = 连**邻居家的墙**也要一起验收；`true` = 只管**自己家**。**不开会怎样**：你装的两个库依赖了不同版本的同一个 `@types/xxx`，两份 `.d.ts` 定义冲突：

```text
node_modules/@types/foo/index.d.ts(42,15): error TS2320: Interface 'Bar' cannot
  simultaneously extend types 'Baz' and 'Qux'.
```

**报错在 `node_modules` 里。你改不了，也不该改（重装依赖就没了），但 CI 就这么红着。**

**关键澄清：它只跳过 `.d.ts`，不跳过你的代码**——它跳过的是"对声明文件的**内部诊断**"；你**误用**一个库的类型，依然会报错。**该不该开**：任何有第三方依赖的项目都**开**（大型项目几乎 100% 开）；`.d.ts` 全是自己生成的 monorepo 可以考虑不开；正在写给别人用的类型定义包不开（要保证自己的声明干净）。**为什么大型项目几乎都开**：因为**你无法修复 `node_modules`**——一个你控制不了、改了会被覆盖、出了错只能等上游发布的检查，关掉它是唯一理性的选择。**代价**：某个库把类型写错了你不会发现，直到运行时，这是必须接受的权衡。

**一句话记住它：`skipLibCheck` 放弃检查你管不着的那部分，换来 CI 可控——所以大型项目几乎都开。**

---

## 8.5 ★ 类型检查与转译的分工

| 工作 | 名字 | 回答什么问题 | 谁擅长 |
|---|---|---|---|
| 把 TS 变成 JS | **转译** | 删掉类型、降级语法 | esbuild / swc / Babel / Vite |
| 检查类型对不对 | **类型检查** | 这段代码有没有类型错误 | tsc |

**类比：翻译 vs 校对。** **翻译**（转译）把中文稿翻成英文——**不需要理解内容对不对**，逐句翻即可，速度可以极快；**校对**（类型检查）通读全文查前后矛盾、人名不一致、数据对不上——**必须看完全文**，所以慢。**Vite / esbuild / swc / Babel 是翻译，不是校对：它们只擦除类型，不做任何类型检查。**

**为什么它们不检查？因为快。** esbuild 比 tsc 快 10~100 倍的根本原因就是它不检查类型：类型检查需要**全项目信息**（这个函数在别的文件怎么声明的？这个泛型在调用点被推成什么？），是 O(项目大小) 的重活；而转译只需要**当前文件**，是 O(文件大小)，天然可并行。

**后果：你的 `npm run dev` 在骗你。**

```ts
// src/bug.ts
export function len(x: string): number { return x.length; }
export const n: number = len(42);       // ❌ 类型错
```

```jsonc
{ "scripts": { "dev": "vite" } }        // Vite 用 esbuild 转译 → 不检查类型
```

**`npm run dev` 完全正常启动，页面照样打开**，你在浏览器里看到 `NaN`，然后花半天 debug 逻辑。**这个错误只有 `tsc` 会告诉你：**

```text
src/bug.ts(5,34): error TS2345: Argument of type 'number' is not assignable to
  parameter of type 'string'.
```

**CI 里必须单独跑 `tsc --noEmit`**：`npx tsc` 会检查 + 生成 `.js`（脏产物，或者被 `outDir` 收走），而 `npx tsc --noEmit` **只检查，什么都不生成**——现代项目只用后者。

```jsonc
{
  "scripts": {
    "dev": "vite",                                       // 快速转译 + HMR（不检查类型）
    "typecheck": "tsc --noEmit",                         // 类型门禁：CI 和 pre-commit 跑它
    "build": "vite build",                               // 出产物（同样不检查类型）
    "build:ci": "npm run typecheck && npm run build",     // 发布前：两件事都做
    "lint": "eslint .",
    "format:check": "prettier --check ."
  }
}
```

**为什么要有 `build:ci`**：因为 `vite build` **不会**帮你检查类型——**如果 CI 里只跑 `vite build`，一个类型错误可以一路发布上线。**

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      # CI 里用 ci 而不是 install：严格按 lockfile 装，装不上就失败
      - run: npm ci

      # ① 类型门禁 —— 整份 CI 里最重要的一步
      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npx eslint .

      - name: Test
        run: npm test

      # ② 构建产物（注意：这一步不做类型检查）
      - name: Build
        run: npm run build
```

三个要点：**用 `npm ci` 不用 `npm install`**；**`tsc --noEmit` 必须单独一步**，不能指望 `build` 顺带；**类型检查放最前面**，它最快给出"能不能继续"的答案。

**为什么 tsc 越来越只当"检查器"**：回顾第 00 章的官方**非目标 4：不做端到端构建流水线**。生态演化出了更好的分工——1999~2015 年 tsc 一个人干两份活（转译 + 检查）；2016~2020 年 Babel 学会擦除类型（`@babel/preset-typescript`），前端转译交给 Babel；2020 年至今 esbuild / swc / Vite 把转译做到极致快，tsc 专注检查。**为什么这个分工是对的**：转译是**每次保存、每次热更新**都要做的事 → 必须极快，宁可放弃检查；类型检查是**提交前、CI 里**才做的事 → 可以慢，但必须准。**把"快"和"准"放在不同时间点跑，是最优解。** **顺带说 TypeScript 7.0**：官方正在用 **Go 重写**编译器（`typescript-go` / `@typescript/native-preview`），解决的就是"检查器太慢"——**这正是"tsc 只当检查器"的必然结果**：既然检查是它唯一的活，那就把这一件事做到极致快。

> **面试可以这么答**："Vite / esbuild 用类型擦除做转译，不做类型检查，所以 `npm run dev` 通过不代表类型对。类型检查必须由 tsc 单独跑，我们 CI 里用 `tsc --noEmit` 当门禁。tsc 现在只当检查器，是因为转译和检查的时间点、性能要求完全不同。TS 7 用 Go 重写也是为了让这个检查器更快。"

**一句话记住它：Vite / esbuild 只擦类型不检查类型，所以"dev 能跑"什么都不能证明——CI 里必须有一步独立的 `tsc --noEmit`。**

---

## 8.6 产物与发布

**类比打印店**：`noEmit` = 只校对不打印；`outDir` = 成品放哪个箱子；`rootDir` = 原稿根目录在哪（用来算成品里的相对路径）；`declaration` = 额外打一份"说明书"（`.d.ts`）；`declarationMap` = 说明书上标注"这句话在原稿第几页"；`sourceMap` = 成品出错时能倒查回原稿哪一行；`removeComments` = 打印时删掉旁批注。

**`noEmit`**：`{ "noEmit": true }`。**不开（默认 `false`）会怎样**：`npx tsc` 会在**源码旁边**生成一堆 `.js`，混进 `src/`；下次编译时 tsc 会把上一轮的 `.js` 也当输入 → 重复声明报错，而且你会 `git add` 一堆垃圾。前端项目**永远写 `true`**；Node 项目里用 `node --experimental-strip-types` 直接跑源码也写 `true`，要发 npm 包就用 `tsconfig.build.jsonc` 单独覆盖。

**`outDir` / `rootDir`**：

```jsonc
{ "outDir": "./dist", "rootDir": "./src", "noEmit": false }
```

```text
src/                     dist/
├── index.ts      →      ├── index.js
├── utils/               ├── utils/
│   └── string.ts        │   └── string.js
└── types.ts             └── types.js
```

**`rootDir` 不开会怎样（真的会翻车）**：不写时 tsc 取**所有输入文件的公共父目录**；如果 `include` 不小心带进了 `src/` 之外的文件（比如 `scripts/build.ts`），公共父目录就变成**项目根目录**，于是产物变成 `dist/src/index.js`——**多套了一层**。然后 `package.json` 的 `"main": "./dist/index.js"` 找不到文件，包一发出去就坏。**所以只要要产物，就显式写 `rootDir`。**

**`declaration` / `declarationMap`**：**`declaration` 不开会怎样**：用你包的人全是报错。

```text
error TS7016: Could not find a declaration file for module 'mylib'.
  '.../mylib/index.js' implicitly has an 'any' type.
```

（这是真实报错：我构造了一个只有 `index.js`、没有 `.d.ts` 的包，tsc 就给这个。）解法只有两个：库作者提供 `.d.ts`，或者用户去装 `@types/mylib`——**你作为库作者不提供，就是把工作推给了全世界。** **`declarationMap` 是干嘛的**：生成 `.d.ts.map`，让用户的编辑器**从 `.d.ts` ctrl+点击能跳回你的 `.ts` 源码**；不开的话用户点进去只看到 `export declare function add(a: Vec2, b: Vec2): Vec2;` 这种没有实现的声明，然后懵了。**纯体验功能，但对外发布的包强烈建议开，差别巨大。**

**`sourceMap`**：**不开会怎样**——线上报错栈长这样：`at t (index-a3f9b2.js:1:48213)`，一行压缩过的 JS、第 48213 个字符，完全没法定位；开了之后（配合 `source-map-support` 或 Sentry）是 `at add (src/vec/math.ts:12:18)`。**注意区分**：`declarationMap` 给**类型跳转**用，`sourceMap` 给**运行时错误栈**用，库作者两个都可以开。

**`removeComments`**：**默认就是 `false`（保留），推荐保留**——因为法律注释必须留在产物里：

```ts
/*!
 * mylib v1.0.0
 * (c) 2025 Your Name. MIT License.
 */
```

**开了它会连 `/*!` 开头的 license 注释一起删掉**，而有些开源协议要求分发时保留版权声明——**删了可能违反协议**。真想减小体积，交给压缩工具（terser 的 `extractComments`）。

### 发布 npm 包：`main` / `types` / `exports`

```jsonc
// 老写法，兼容性最好
{
  "name": "mylib", "version": "1.0.0",
  "main": "./dist/index.js",           // 运行时入口
  "types": "./dist/index.d.ts",        // 类型入口（TS 看它）
  "files": ["dist"],                   // 发布时只打包 dist
  "scripts": {
    "build": "tsc -p tsconfig.build.jsonc",
    "prepublishOnly": "npm run build"   // 发布前自动构建，防手滑
  }
}
```

**`types` 字段写错会怎样**：用户装完你的包，导入时全变 `any` 并报 `TS7016`——**这就是"我明明写了类型，为什么别人用起来是 any"的答案：你忘了在 `package.json` 里指路。**

```jsonc
// 现代写法：exports 条件导出
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",       // ⚠️ 必须放第一位
      "import": "./dist/index.js",         // ESM 用户
      "require": "./dist/index.cjs"        // CJS 用户
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"]
}
```

三条必须知道的规则：① **`types` 条件必须写在最前面**——Node 和 tsc 都**按顺序匹配第一个命中的条件**，放后面等于没写；② **`exports` 一写，`main` 就基本被忽略**，而且会**关闭深层路径访问**（`import x from 'mylib/dist/internal/secret.js'` 直接报错）——这是好事，它把"哪些文件是公共 API"变成了硬约束；③ **双格式（ESM + CJS）发布要跑两次 tsc**（`build:esm` + `build:cjs`），或者更简单：**只发 ESM**（Node 20+ 生态已经接受），省掉一半麻烦。

### 开发 / 构建两套配置：`tsconfig.build.jsonc`

| | 开发配置 | 构建配置 |
|---|---|---|
| 目的 | 看得见错 | 出正确的产物 |
| `noEmit` | `true` | `false` |
| `outDir` / `rootDir` | 不需要 | 必须有 |
| `declaration` | 不需要 | 需要 |
| `include` | 全部（含测试） | 只有源码 |
| 谁在用 | 编辑器 / CI 类型门禁 | `npm run build` |

**不分两套会怎样**：你得在同一个文件里把 `noEmit` 改成 `false`、构建完再改回 `true`——**忘记改回来 → CI 白跑，或者本地跑出一堆 `.js` 垃圾。**

```jsonc
// package.json：两条脚本各管一件事
{ "scripts": {
  "typecheck": "tsc --noEmit",                 // 主配置，只管检查
  "build": "tsc -p tsconfig.build.jsonc"       // 构建配置，只管出产物
} }
```

```jsonc
// tsconfig.build.jsonc
{
  "extends": "./tsconfig.json",        // 继承一切：strict / target / module...
  "compilerOptions": {
    "noEmit": false,                   // 覆盖父配置
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "allowImportingTsExtensions": false
  },
  "include": ["src/**/*.ts"],          // 收窄范围
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**坑一：`include` / `exclude` 是顶层字段，不能塞进 `compilerOptions`**，否则报

```text
error TS5023: Unknown compiler option 'include'.
```

**坑二：`allowImportingTsExtensions` 和 `noEmit: false` 互斥。** 源码里写了 `.ts` 后缀的相对导入时：

```text
error TS5097: An import path can only end with a '.ts' extension when
  'allowImportingTsExtensions' is enabled.
```

而你**不能**在构建配置里开它，否则：

```text
error TS5096: Option 'allowImportingTsExtensions' can only be used when either
  'noEmit' or 'emitDeclarationOnly' is set.
```

**这就形成了死结。** 真实项目的做法是：**源码里相对导入统一写 `.js` 后缀**（NodeNext 规则），这样开发配置和构建配置都能过。

**一句话记住它：发布 npm 包必须用 `tsconfig.build.jsonc` 通过 `extends` 把"只想看错"和"真要出文件"分成两套——别靠手动改 `noEmit`。**

---

## 8.7 Lint 与格式化

| 工具 | 管什么 | 类比 |
|---|---|---|
| **tsc** | 类型对不对 | 语法老师，只查"这句话合不合语法" |
| **ESLint** | 代码**写法**好不好 | 语文老师，管你"是否啰嗦、有没有更好的表达" |
| **Prettier** | 代码**长相** | 排版工人，只管空格 / 换行 / 引号 |

**为什么必须用 typescript-eslint，而不是普通 ESLint**：普通 ESLint 的工作方式是 `读源码文本 → 解析成语法树（AST）→ 按规则检查`，它的 AST **只有语法信息，没有类型信息**，所以**不可能**回答这些问题：

| 你想检查的问题 | 普通 ESLint | typescript-eslint |
|---|---|---|
| `await` 了一个不是 Promise 的东西 | ❌ | ✅（需要类型） |
| `if` 条件永远为真 | ❌ | ✅（需要类型） |
| 可选链用在一个不可能为 undefined 的值上 | ❌ | ✅ |
| 这个变量是 `string` 还是 `number` | ❌ | ✅ |
| 未使用的变量 / 缩进 / 引号 | ✅ | ✅ |

**类比**：**普通 ESLint** = 只看**这一页稿纸**的编辑，能发现错别字、能发现这段啰嗦；**typescript-eslint（带类型信息）** = 手里有**全书设定集**的编辑，能发现"第 3 章说主角怕水，第 5 章他跳进河里救人"——**这需要跨文件的信息**。**这就是为什么要有 typescript-eslint：它把 TypeScript 的类型信息系统接进了 ESLint，让 lint 规则能问"这个表达式的类型是什么"。**

**最小可用配置**：

```bash
npm i -D eslint@^9 typescript-eslint@^8 prettier eslint-config-prettier
```

```js
// eslint.config.js —— ESLint 9 的 flat config
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // 1) ESLint 官方推荐规则（通用 JS 规则）
  eslint.configs.recommended,

  // 2) typescript-eslint 推荐规则；TypeChecked 版本需要"类型信息"，更强也更慢
  ...tseslint.configs.recommendedTypeChecked,

  // 3) 告诉 typescript-eslint 去哪里找 tsconfig（类型感知规则的必需配置）
  {
    languageOptions: {
      parserOptions: {
        projectService: true,                     // 自动找最近的 tsconfig
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // 4) 关掉所有和 Prettier 冲突的格式规则（必须放最后）
  prettier,

  // 5) 你自己的规则覆盖
  {
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // 6) 别 lint 这些目录
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] }
);
```

```jsonc
// .prettierrc
{ "semi": true, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

> ⚠️ **`eslint-config-prettier` 一定要放在配置数组的最后一位。** 它的作用就是"关掉所有和 Prettier 冲突的 ESLint 格式规则"；放前面会被后面的规则重新打开，然后你会陷入"ESLint 和 Prettier 互相打架、保存一次代码跳三次"的地狱。

**最值得开的三条规则**：

**① `@typescript-eslint/no-floating-promises`** —— 调用了返回 Promise 的函数却没处理结果。

```ts
async function saveUser(u: User) {
  db.save(u);            // ❌ 忘了 await！失败没有任何人知道 → unhandledRejection，可能静默丢数据
  return u;
}
async function saveUser2(u: User) { await db.save(u); return u; }         // ✅ 等它
function fireAndForget(u: User) { void db.save(u).catch(reportError); }   // ✅ 或明确"我故意不等"并兜底
```

**为什么排第一**：异步 bug 是最难查的一类——不会立刻报错，只在某个时刻让数据不一致或进程崩溃；**这条规则能在编译期抓到"忘了 await"**，而 `tsc` 自己做不到（`Promise` 是个合法值，浮着不报错）。

**② `@typescript-eslint/no-unnecessary-condition`** —— 条件永远为真或永远为假。

```ts
function getName(user: { name: string }): string {
  if (user) return user.name;      // ❌ 类型里没有 undefined，这个 if 永远为真
  return '匿名';
}
function getName2(user: { name: string } | undefined): string {
  return user?.name ?? '匿名';     // ✅ 类型说可能没有，代码才需要防
}
```

**为什么值钱**：它是一面**照妖镜**——代码在防 `undefined` 但类型里没有 `undefined`，说明**实际运行时真的可能是 undefined，你的类型标注错了**，它帮你发现"类型和现实脱节"的地方。

**③ `@typescript-eslint/no-explicit-any`** —— 不许写 `any`（`function parse(data: any): any` → 改成 `(data: string): unknown`）。**它不是"永远不能写 any"**，而是"**写任何 `any` 都必须是一次有意识的、能被 code review 看到的决定**"。**实用建议**：老项目先设 `"warn"`，让每一处新增的 `any` 出现在输出里，等 `warn` 归零再升级成 `"error"`。

**一句话记住它：tsc 管"类型对不对"，ESLint 管"写法好不好"，Prettier 管"长得齐不齐"——而 ESLint 必须装 typescript-eslint，因为普通 ESLint 看不懂类型。**

---

## 8.8 从 JS 项目迁移到 TS

**别想着"一次性全改完"。** 一个 5 万行的 JS 项目全量迁移几乎必然失败——你会在一个巨大分支上被几千个类型错误活埋，然后被迫 `--force` 合并，然后项目就半死不活了。**类比：换发动机，不是换飞机**——换飞机是停飞、清空、重装；换发动机是一台一台换，**每次换完飞机都能飞**。

**`allowJs` / `checkJs` / `// @ts-check`**：`{ "allowJs": true }` 让 tsc **认识 `.js` 文件**（把 `import './util'` 解析到 `util.js`）；**不开会怎样**：`error TS2307: Cannot find module './util' or its corresponding type declarations.` ——**注意 `allowJs: true` 不会检查 `.js` 的类型**，`.js` 里的东西在 TS 眼里基本是 `any`。

`{ "allowJs": true, "checkJs": true }` 才是**真的检查** `.js`（用 JSDoc 注释当类型标注）。真实效果：

```text
q14-nojsdoc.js(2,34): error TS2339: Property 'age' does not exist on type
  '{ id: number; name: string; }'.
```

它能从对象字面量推断出类型。**但 `checkJs: true` 是一颗炸弹**：整个项目所有 JS 文件**同时**开始报错，5 万行项目可能瞬间几千个错误——**所以不要一上来就开它**，用文件级开关起步：

```js
// @ts-check
/** @param {string} name @returns {string} */
export function greet(name) { return '你好，' + name; }
greet(123);   // ❌ error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
```

| 配置 | 效果 |
|---|---|
| `allowJs: true`，`checkJs: false`（默认） | 所有 `.js` 都不检查 |
| 同上 + 文件里写 `// @ts-check` | **只有写了这行的文件**被检查 |
| `allowJs: true`，`checkJs: true` | 所有 `.js` 都被检查（炸弹） |

**`// @ts-check` 就是"文件级的 `checkJs`"**，它让你能一个文件一个文件地推进。JSDoc 速查：`/** @type {string} */ let name;`、`/** @type {{ id: number, name: string }} */ const user = {...};`、`/** @param {number} a @returns {number} */ function add(a, b) {...}`、`/** @typedef {{ id: number, name: string }} User */`。

### 渐进式迁移的 5 步

**第 1 步：装依赖 + 一份"宽松到底"的配置**（`npm i -D typescript @types/node`）

```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2023"],
    "module": "NodeNext", "moduleResolution": "NodeNext",
    "allowJs": true, "checkJs": false,
    "strict": false, "noImplicitAny": false,
    "noEmit": true, "skipLibCheck": true,
    "esModuleInterop": true, "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

跑一遍 `npm run typecheck`（脚本是 `"typecheck": "tsc --noEmit"`），**这一步应该就过了**（或者只有很少的错）。错太多就先把 `include` 缩小，排除最难啃的目录。

**第 2 步：逐文件加 `// @ts-check`，先啃工具函数。** 从**叶子节点**开始——"被很多文件依赖、但自己很少依赖别人"的文件。

```js
// src/utils/format.js
// @ts-check
/** @param {number} amount @returns {string} */
export function formatMoney(amount) { return amount.toFixed(2); }
/** @param {string | null | undefined} s @returns {string} */
export function safeTrim(s) { return (s ?? '').trim(); }
```

**为什么从叶子开始**：叶子改完之后，所有 import 它的父文件**自动获得准确类型**，**越往上改，收益越大**。验收标准：`npm run typecheck` 依然全绿。

**第 3 步：逐文件改名 `.js` → `.ts`。** 一次改一个（或一小批），改完立刻 `npm run typecheck`。

| 报错 | 原因 | 修法 |
|---|---|---|
| `TS7006` | 函数参数隐式 `any` | 加类型；暂时不想就写 `: any` 认账 |
| `TS2339` | 访问了不存在的属性 | 补类型定义，或者确实是 bug → 修 |
| `TS2531` / `TS2532` | 可能 undefined | 加判断或 `??` |
| `TS2307` | 找不到模块 | 检查路径；NodeNext 下要写 `.js` 后缀 |

> **关键心法**：一个错误**能在 5 分钟内修好**就修；**修不好、或者要改业务逻辑才能修的，先写 `: any` / `// @ts-expect-error` 记账，继续往下改。** **记账比阻塞重要**，最后一步统一清账。

**第 4 步：分档收紧 `strict`。** **不要一次跳到 `strict: true`**，一档一档来，每档都能单独提交：4.1 档 `{ "noImplicitAny": true, "noImplicitThis": true }` → 4.2 档再加上 `"strictNullChecks": true` → 4.3 档 `{ "strict": true }`。**为什么是这个顺序**：`noImplicitAny` 先开，让代码**表达能力**先到位；`strictNullChecks` 后开，因为很多"可能 undefined"的问题**只有在参数类型明确之后才能被发现**——如果参数还是 `any`，`strictNullChecks` 什么都查不出来。错太多时用"目录级豁免"过渡：

```jsonc
// tsconfig.strict.json —— 只对已经改干净的目录开严格检查
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "strict": true },
  "include": ["src/core/**/*.ts", "src/api/**/*.ts"]
}
```

CI 里跑两个检查：宽松的查全项目，严格的查已迁移目录。

**第 5 步：修 `any`，去掉逃生舱。** 先用 `grep -rn ": any" src/ | wc -l`（以及 `@ts-expect-error` / `@ts-ignore`）看看还有多少，然后 ① **`any` → 真实类型**（实在不知道就用 `unknown`）；② **`@ts-expect-error` → 修掉问题**，或者升级到第 09 章的运行时校验；③ **`@ts-ignore` → 全部换成 `@ts-expect-error`**。**建议设一条团队规则：新增 `any` 必须在 PR 描述里说明原因。**

### `// @ts-expect-error` vs `// @ts-ignore`（面试考点）

| 指令 | 人话 |
|---|---|
| `// @ts-ignore` | **不管这里有没有错，都别报** |
| `// @ts-expect-error` | **这里一定有个错，我暂时不管；如果没错，你要报错提醒我** |

**类比**：`@ts-ignore` = 门上贴"**此门永久封闭"**——哪怕门早修好了，纸条还在；`@ts-expect-error` = 纸条上写**"这个锁坏了，暂时别用**"，**并且安排了一个监督员**：锁一修好，监督员立刻来找你撤纸条。**为什么优先用它：因为它会自我销毁。**

```ts
// @ts-ignore
doSomethingStrange();
// 三年后上游修好了类型。这行注释还在，还在压制着……什么都没有。
// 没有人会去删它。它会一直留着，成为"没人知道为什么在这儿"的谜。

// @ts-expect-error
doSomethingStrange();
// 三年后上游修好了类型 → 编译报错：
// error TS2578: Unused '@ts-expect-error' directive.
// → 你被迫删掉这行注释 → 代码自动变干净
```

**这个报错是真的**：`error TS2578: Unused '@ts-expect-error' directive.`
**核心原因：`@ts-expect-error` 把一个"永远不会被清理的注释"，变成了"一个会自己提醒你清理的 TODO"。**

```ts
// ✅ 紧跟被压制的行，并说明原因
// @ts-expect-error 上游库的类型漏了 error.cause 字段（已提 PR #1234）
return new Error(msg, { cause: originalError });

// ✅ 写在对象属性上
const config = {
  // @ts-expect-error 这个内部选项没写在公开类型里，但运行时支持
  internalFlag: true,
};

// ❌ 坏：和代码中间隔了别的行，指令会失效或压制到错误的行
```

顺手大扫除：`npx tsc --noEmit --reportUnnecessaryIgnoreComments`，它会把"压了但没必要"的 `@ts-ignore` 也报出来。

> **面试怎么答**："优先用 `@ts-expect-error`，因为它自带'过期检测'。上游类型修好之后，它会报 **TS2578: Unused '@ts-expect-error' directive**，逼你把这行注释删掉。而 `@ts-ignore` 是永久静音的——不管有没有错都不报，所以一旦写上就没人会去删，最终变成技术债。另外 `@ts-expect-error` 语义更准确：它表达的是'我知道这里有错，暂时接受'，而不是'这里闭眼不看'。"

**一句话记住它：`@ts-ignore` 是永久静音，`@ts-expect-error` 是会过期的静音——后者在错误消失时会主动叫你删掉它。**

---

## 8.9 报错速查表

这 12 个错误码覆盖新手 90% 的报错。

| 错误码 | 一句话人话 | 最常见的修法 |
|---|---|---|
| **TS2322** | "A 类型不能赋给 B 类型"——两边对不上 | 看清 `Type 'X' is not assignable to type 'Y'`：改值的类型、改目标的类型，或者加类型守卫收窄 |
| **TS2339** | "这个类型上没有这个属性"——八成拼错了，或者类型定义缺了 | 检查拼写；补 interface 字段；字段真可能不存在就用 `?.` 或加进类型 |
| **TS2345** | "传给函数的参数类型不对" | 改参数类型；或者把函数签名参数放宽（常见：`string` → `string \| undefined`） |
| **TS2531** | "对象可能是 `null`" | 加 `if (x !== null)`；或 `x?.`；或 `x!`（确认不为 null 时） |
| **TS2532** | "对象可能是 `undefined`" | 同上：判断 / `??` 兜底 / `?.`。**开了 `noUncheckedIndexedAccess` 后下标访问必出** |
| **TS7006** | "参数 `x` 隐式地是 `any`"——你没写类型，编译器也推不出来 | 给参数加类型注解。**`strict` 下最高频的一个** |
| **TS7016** | "找不到模块的类型声明文件"——这个库没有 `.d.ts` | `npm i -D @types/包名`；或自己写 `.d.ts`；或 `declare module '包名';`（临时） |
| **TS7053** | "不能用 `string` 去索引这个类型"——它的键不是任意的 | 把键收窄成 `keyof T`；或给对象加索引签名 `Record<string, T>`；`Object.keys` 要断言成 `(keyof T)[]` |
| **TS18046** | "`x` 的类型是 `unknown`"——不能直接读属性 / 调用 | 先收窄：`x instanceof Error` / `typeof x === 'string'` / `'field' in x` |
| **TS18048** | "`x` 可能是 `undefined`"（`strictNullChecks` 的现代版报错） | `if (!x) return;` 收窄，或者 `x?.y ?? 默认值` |
| **TS2741** | "少了一个必需属性" | 补上缺的字段；或改成可选 `?`；或用 `Partial<T>` |
| **TS2769** | "没有重载匹配这次调用" | 看报错里每个重载分别失败的原因；通常是参数类型 / 个数不对；也可能需要显式泛型参数 |

**怎么读 TS 报错（比记住 12 个码更有用）**：

```text
error TS2322: Type 'string' is not assignable to type 'number'.
                ↑ 谁           ↑ 不能赋给谁
```

**这个句式读作"我把 A 塞进 B，塞不进去"。然后从最内层那句话开始修**（TS 的报错是多层的，最内层才是根因）：

```text
error TS2769: No overload matches this call.
  Overload 1 of 2, '(a: number, b: number): number', gave the following error.
    Argument of type 'string' is not assignable to parameter of type 'number'.
                              ↑ 根因在这一行
  Overload 2 of 2, '(a: string, b: string): string', gave the following error.
    Argument of type 'number' is not assignable to parameter of type 'string'.
```

**一句话记住它：报错从最内层那句话开始读；`Type 'A' is not assignable to type 'B'` 永远读作"我把 A 塞进 B 塞不进去"。**

---

## 8.10 动手练习

### 练习 1：亲手看一次"配置是怎么合并的"

写一个 `base.json`：

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true,
    "paths": { "@/*": ["./src/*"], "#/*": ["./internal/*"] }
  },
  "include": ["src/**/*.ts"]
}
```

再写一个 `tsconfig.json` 继承它，**只覆盖 `paths` 里的 `@/*`**，然后运行 `npx tsc --showConfig`。

**问题**：输出里的 `paths` 还剩几个键？`target` 是哪个值？为什么？

<details><summary>提示</summary>

`paths` 是**整块替换**，不是深度合并，所以 `#/*` 会消失；`target` 保留 `ES2020`。另外如果你在子配置里写了 `include`，父配置的 `include` 会**完全失效**。

</details>

### 练习 2：用 `--showConfig` 破案

同事说："我明明写了 `strict: true`，为什么 `arr[0]` 还是被当成 `number`，不是 `number | undefined`？" ① 用 `--showConfig` 确认 `strict` 生效了；② 找出真正负责这件事的选项名；③ 打开它，然后用**三种不同写法**（判断 / `??` / `!`）修掉随之而来的报错。

**问题**：为什么 TS 团队没把这个选项放进 `strict` 套餐？

<details><summary>提示</summary>

选项是 `noUncheckedIndexedAccess`。没进 `strict` 是因为它是**破坏性的**——打开它会让几乎所有现有代码报错，属于"会让整个生态炸掉"的级别。

</details>

### 练习 3：亲眼看见"Vite 不检查类型"

① 建一个最小的 Vite + React + TS 项目；② 在某个组件里写 `const n: number = 'hello';`；③ 运行 `npm run dev`（页面能正常打开吗？）；④ 运行 `npx tsc --noEmit`（这次报错了吗？）；⑤ 在 `package.json` 里配一个 `build:ci`，要求"先类型检查，再构建"。

**问题**：如果 CI 里只有 `vite build` 这一步，第 ② 步的错误会被发布到线上吗？

<details><summary>提示</summary>

会。`vite build` 用 esbuild 转译，**不做类型检查**。这就是 `build:ci` 必须写成 `npm run typecheck && npm run build` 的原因。

</details>

### 练习 4：从一个真 JS 项目开始迁移

① 建一个新分支；② 按 8.8 节第 1 步加一份"宽松到底"的 `tsconfig.json`；③ **选 3 个叶子工具函数文件**加 `// @ts-check` 并补 JSDoc 类型；④ 把它们改名成 `.ts`，修掉所有报错；⑤ 单独打开 `noImplicitAny`，看还剩多少错。

**问题**：第 ⑤ 步之后的错误，绝大多数属于哪一类？为什么？

<details><summary>提示</summary>

绝大多数是 `TS7006`（参数隐式 any）。因为 JS 函数参数通常没有类型信息，TS 无法从函数体反推输入的完整来源。这就是为什么 `noImplicitAny` 是迁移的**第一步**——它逼你把函数的"输入契约"写清楚，后面所有检查才有基础。

</details>

### 练习 5（进阶）：给一个包配好发布三件套

假设你要发布 `vec2`，源码在 `src/`，入口 `src/index.ts`。① 写 `tsconfig.build.jsonc`，通过 `extends` 继承主配置，产出 ESM + `.d.ts` 到 `dist/`；② 配好 `package.json` 的 `main` / `types` / `exports` / `files`；③ 加 `prepublishOnly` 保证发布前一定构建；④ 在另一个空项目里 `npm i ../vec2` 本地安装，import 一个函数，**确认编辑器能跳进 `.d.ts`，并且能 ctrl+点击回到 `.ts` 源码**。

**问题**：如果第 ④ 步 ctrl+点击跳不进 `.ts` 源码，最可能是哪个选项没开？

<details><summary>提示</summary>

`declarationMap: true`。生成的 `.d.ts.map` 才是映射的关键。另外检查 `package.json` 的 `files` 有没有把 `dist`（含 `.map` 文件）一起发布出去。

</details>

---

## 8.11 本章小结

```jsonc
// tsconfig.json —— Node 服务 / CLI 的推荐起点
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,

    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["**/*.ts"]
}
```

| 主题 | 一句话结论 |
|---|---|
| tsconfig 是什么 | 项目根目录的施工规范；不写就会用 ES5 + 全宽松的默认值 |
| 文件范围 | `files ∪ (include − exclude)`；`exclude` 拦不住被 import 的文件 |
| `--showConfig` | 排查神器，打印合并 + 补默认值之后的最终配置 |
| `target` / `lib` | 一个管语法，一个管 API；`ES2022` + `["ES2023"]` 稳妥 |
| `module` / `moduleResolution` | Node 用 `NodeNext`，前端用 `Bundler`；必须配对 |
| `strict` | 一个套餐 9 个开关，每个都对应一类真实事故，别拆开 |
| 隐藏关卡 | 真正减少线上事故的是 `noUncheckedIndexedAccess` 这一批 |
| `skipLibCheck` | 放弃检查你管不着的 `.d.ts`，换 CI 可控；大型项目几乎都开 |
| 检查 vs 转译 | Vite/esbuild 只擦类型不检查；CI 必须有独立的 `tsc --noEmit` |
| 产物与发布 | 开发/构建两套配置用 `extends` 分家；`declarationMap` 是发布体验的关键 |
| Lint | ESLint 管写法，Prettier 管长相，typescript-eslint 提供类型感知 |
| 迁移 | 换发动机不换飞机：`@ts-check` 起步，逐文件改名，分档收紧 `strict` |
| `@ts-expect-error` | 优先用它，因为错误消失时会报 TS2578 主动提醒你清理 |

**最后一句话，也是本章我最想让你记住的：**

> **`tsconfig.json` 不是"让编译器闭嘴的开关"，而是"你希望这个项目允许犯哪些错"的一份正式声明。读懂它，你就读懂了整个项目的工程底线。**

---

下一章我们填第 00 章留下的那个坑：**类型只约束你自己的代码，不约束外面的世界**。

→ [第 09 章 · 实战设计模式](09-实战设计模式.md)
（`Result<T, E>`、业务状态机、Branded Type、类型安全 API 层、`satisfies`，以及 zod 该站在哪个位置）
