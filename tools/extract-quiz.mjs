/**
 * 从 docs/10-测试题与答案.md 抽取结构化题库，输出 site/quiz-bank.json
 *
 * 用法（在 tools 目录下）：
 *   node extract-quiz.mjs
 *
 * 抽取内容：
 *   - 第一关 判断对错（20 题）
 *   - 第二关 说出类型（25 题）
 *   - 面试速查表里的高频题（从 11-面试速查表.md 抽取问答对）
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const docsDir = path.join(ROOT, 'docs');
const outDir = path.join(ROOT, 'site');

const md10 = fs.readFileSync(path.join(docsDir, '10-测试题与答案.md'), 'utf8');

const bank = { stage1: [], stage2: [], interview: [] };

/* ---------- 第一关：判断题 ---------- */
function section(text, startRe, endRe) {
  const s = text.search(startRe);
  if (s < 0) return '';
  const rest = text.slice(s);
  const e = rest.slice(1).search(endRe);
  return e < 0 ? rest : rest.slice(0, e + 1);
}

const s1 = section(md10, /## 第一关 · 概念快问快答/, /\n## 第二关 · 说出类型/);
const s1ans = section(md10, /## 第一关答案/, /\n## 第二关答案/);

// 解析题目：行首 `N. xxx`
const q1 = {};
for (const line of s1.split('\n')) {
  const m = line.match(/^(\d+)\.\s+(.*)$/);
  if (m) q1[Number(m[1])] = m[2].trim();
}
// 解析答案表：| N | **对** | 解析 | 出处 |
const a1 = {};
for (const line of s1ans.split('\n')) {
  const m = line.match(/^\|\s*(\d+)\s*\|\s*\*\*(对|错)\*\*\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/);
  if (m) a1[Number(m[1])] = { answer: m[2] === '对', why: m[3], from: m[4] };
}
for (const n of Object.keys(q1).map(Number).sort((a, b) => a - b)) {
  const a = a1[n];
  bank.stage1.push({
    id: `s1-${n}`,
    no: n,
    q: q1[n],
    answer: a ? a.answer : null,
    why: a ? a.why : '',
    from: a ? a.from : '',
  });
}

/* ---------- 第二关：说出类型 ---------- */
const s2 = section(md10, /## 第二关 · 说出类型/, /\n## 第三关 · 改错/);
const s2ans = section(md10, /## 第二关答案/, /\n## 第三关答案/);

// 代码块里形如 `// N` 后面的代码行
const codeLines = {};
const codeBlockMatch = s2.match(/```ts\n([\s\S]*?)```/);
if (codeBlockMatch) {
  const lines = codeBlockMatch[1].split('\n');
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\/\/\s*(\d+)\s*$/);
    if (m) { cur = Number(m[1]); codeLines[cur] = []; continue; }
    if (cur !== null && line.trim()) codeLines[cur].push(line);
  }
}
// 解析答案表：| N | `type` | 关键点 |
const a2 = {};
for (const line of s2ans.split('\n')) {
  const m = line.match(/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/);
  if (m) a2[Number(m[1])] = { type: m[2], note: m[3] };
}
for (const n of Object.keys(a2).map(Number).sort((a, b) => a - b)) {
  bank.stage2.push({
    id: `s2-${n}`,
    no: n,
    code: (codeLines[n] || []).join('\n'),
    type: a2[n].type,
    note: a2[n].note,
  });
}

/* ---------- 面试题（从 11 章抽取） ---------- */
const md11 = fs.readFileSync(path.join(docsDir, '11-面试速查表.md'), 'utf8');
// 格式：**Q1: 问题？**  换行后  **答：xxxx**
// 抽取策略：先按 **Q<n>: ...?** 定位所有问句，再截取到下一个 **Q 为止
const qMarks = [];
const reQ = /\*\*Q(\d+)[:：]\s*([\s\S]*?)\*\*/g;
let mq;
while ((mq = reQ.exec(md11)) !== null) {
  if (mq[2].trim().endsWith('?') || mq[2].trim().endsWith('？')) {
    qMarks.push({ no: Number(mq[1]), q: mq[2].trim(), start: mq.index, end: reQ.lastIndex });
  }
}
for (let i = 0; i < qMarks.length; i++) {
  const cur = qMarks[i];
  const next = qMarks[i + 1];
  let body = md11.slice(cur.end, next ? next.start : cur.end + 2000);
  // 去掉可能的 ### 小节标题尾巴
  body = body.split(/\n###\s/)[0].trim();
  if (body.length < 10) continue;
  bank.interview.push({
    id: `iv-${cur.no}-${i}`,
    no: cur.no,
    q: cur.q,
    a: body.slice(0, 1500),
  });
}

/* ---------- 输出 ---------- */
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'quiz-bank.json');
fs.writeFileSync(out, JSON.stringify(bank, null, 2), 'utf8');

console.log('第一关（判断）   ', bank.stage1.length, '题');
console.log('第二关（说类型） ', bank.stage2.length, '题');
console.log('面试题           ', bank.interview.length, '题');
const missingS1 = bank.stage1.filter((x) => x.answer === null).length;
const missingS2 = bank.stage2.filter((x) => !x.type).length;
if (missingS1 || missingS2) {
  console.log('⚠ 缺答案: 第一关', missingS1, '第二关', missingS2);
}
console.log('写入 ->', path.relative(ROOT, out));
