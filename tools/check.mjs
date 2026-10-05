/**
 * 教程仓库自检：文档清单 / 编码 / 内部链接 / 章节齐备性 / HTML 阅读版结构。
 *
 * 用法（在 tools 目录下）：
 *   node check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'tools']);

function walk(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

let problems = 0;

// ---- 1. 文档清单 ----
console.log('==================== 1. 文档清单 ====================');
const mds = [
  path.join(ROOT, 'README.md'),
  path.join(ROOT, '速通版-2小时上手TypeScript.md'),
  ...walk(path.join(ROOT, 'docs'), '.md').sort(),
];
let totalLines = 0;
let totalBytes = 0;
for (const f of mds) {
  const text = fs.readFileSync(f, 'utf8');
  const n = text.split('\n').length;
  totalLines += n;
  totalBytes += Buffer.byteLength(text);
  console.log('  ' + path.relative(ROOT, f).padEnd(46) + String(n).padStart(6) + ' 行');
}
console.log('  ' + '-'.repeat(54));
console.log('  ' + ('合计 ' + mds.length + ' 个文件').padEnd(44) + String(totalLines).padStart(6) + ' 行');
console.log('  ' + '总字节'.padEnd(46) + (totalBytes / 1024).toFixed(0).padStart(6) + ' KB');

// ---- 2. 编码 ----
console.log('\n==================== 2. 编码检查 ====================');
let encBad = 0;
for (const f of mds) {
  const buf = fs.readFileSync(f);
  const text = buf.toString('utf8');
  const hasBOM = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const bad = (text.match(/\uFFFD/g) ?? []).length;
  if (hasBOM || bad > 0) {
    encBad++;
    problems++;
    console.log('  ⚠ ' + path.relative(ROOT, f) + '  BOM=' + hasBOM + '  替换字符=' + bad);
  }
}
console.log(encBad === 0 ? '  OK  全部 UTF-8，无 BOM、无解码失败字符' : '  ❌ ' + encBad + ' 个文件有问题');

// ---- 3. 内部链接 ----
console.log('\n==================== 3. 内部链接 ====================');
let checked = 0, broken = 0;
for (const f of mds) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      let t = m[1];
      if (/^(https?:|mailto:|#)/.test(t)) continue;
      t = t.replace(/#.*$/, '').replace(/^<|>$/g, '');
      if (!t) continue;
      checked++;
      if (!fs.existsSync(path.resolve(path.dirname(f), decodeURIComponent(t)))) {
        broken++;
        problems++;
        console.log('  BROKEN  ' + path.relative(ROOT, f) + ':' + (i + 1) + '  ->  ' + t);
      }
    }
  });
}
console.log('  扫描 ' + checked + ' 个内部链接，断链 ' + broken + ' 个');

// ---- 4. 章节齐备性 ----
console.log('\n==================== 4. 章节齐备性 ====================');
const present = fs.readdirSync(path.join(ROOT, 'docs'));
const missing = [];
for (const n of ['00','01','02','03','04','05','06','07','08','09','10','11']) {
  const hit = present.find((x) => x.startsWith(n + '-'));
  if (!hit) missing.push(n);
  console.log('  ' + n + '  ' + (hit ? 'OK  ' + hit : '❌ 缺失'));
}
if (missing.length) problems++;

// ---- 5. 示例代码 ----
console.log('\n==================== 5. 配套代码 ====================');
const ts = walk(path.join(ROOT, 'examples'), '.ts')
  .filter((f) => !f.includes('node_modules'))
  .sort();
for (const f of ts) {
  const n = fs.readFileSync(f, 'utf8').split('\n').length;
  console.log('  ' + path.relative(ROOT, f).padEnd(46) + String(n).padStart(6) + ' 行');
}
const stray = ts.filter((f) => path.basename(f).startsWith('_'));
if (stray.length) {
  problems++;
  console.log('\n  ⚠ 发现临时/探针文件，应删除：');
  stray.forEach((f) => console.log('      ' + path.relative(ROOT, f)));
} else {
  console.log('  OK  无临时/探针文件残留');
}

// ---- 6. HTML 阅读版 ----
console.log('\n==================== 6. HTML 阅读版 ====================');
const htmlPath = path.join(ROOT, 'TypeScript从零到一-阅读版.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const c = (re) => (html.match(re) ?? []).length;
  const open = c(/<section class="chapter"/g);
  const close = c(/<\/section>/g);
  console.log('  大小: ' + (html.length / 1024 / 1024).toFixed(2) + ' MB');
  console.log('  章 section: ' + open + ' 开 / ' + close + ' 闭' + (open === close ? '  OK' : '  ❌ 不匹配'));
  console.log('  表格 ' + c(/<table>/g) + ' / 代码块 ' + c(/<pre><code/g) + ' / 二级目录项 ' + c(/class="nav-sub"/g));
  const fences = c(/```/g);
  console.log('  未渲染的三反引号: ' + fences + (fences === 0 ? '  OK' : '  ❌'));
  if (open !== close || fences > 0) problems++;
} else {
  problems++;
  console.log('  ❌ 未生成（在 tools 下跑 npm run build:html）');
}

console.log('\n====================================================');
console.log(problems === 0 ? '全部检查通过 ✅' : '存在 ' + problems + ' 个问题 ❌');
process.exitCode = problems === 0 ? 0 : 1;
