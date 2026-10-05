/**
 * 第 10 章 第五关 · 第 3 题参考答案：类型安全的表单校验
 *
 * 运行：node answers/a3-validate.ts
 */

console.log('========== 第 3 题：类型安全的表单校验 ==========');

type FormErrors<T> = Partial<Record<keyof T, string>>;

type Rules<T> = { [K in keyof T]?: (v: T[K]) => string | null };

function validate<T extends object>(values: T, rules: Rules<T>): FormErrors<T> {
  const errors: FormErrors<T> = {};

  // 这里有一处 as：遍历泛型对象的键时，TS 无法保持"键与值类型一一对应"的关系。
  // 这是索引访问在泛型上的已知局限，把它关在这个小函数里，并写清楚理由。
  for (const key of Object.keys(rules) as (keyof T)[]) {
    const rule = rules[key];
    if (!rule) continue;
    const fn = rule as (v: T[keyof T]) => string | null;
    const message = fn(values[key]);
    if (message !== null) {
      errors[key] = message;
    }
  }

  return errors;
}

// ---- 验证 ----
const values = { username: 'ab', age: 12, newsletter: false };

const errors = validate(values, {
  username: (v) => (v.length < 3 ? '用户名至少 3 位' : null), // v 自动是 string
  age: (v) => (v < 18 ? '必须年满 18 岁' : null), // v 自动是 number
  // age: (v) => v.length,     // ❌ TS2339：number 上没有 length
  // nope: () => null,         // ❌ 不存在的字段，编译报错
});

console.log('  表单值:', values);
console.log('  校验结果:', errors);

const passed = validate(
  { username: 'tomcat', age: 20, newsletter: true },
  {
    username: (v) => (v.length < 3 ? '用户名至少 3 位' : null),
    age: (v) => (v < 18 ? '必须年满 18 岁' : null),
  },
);
console.log('  全部通过时:', passed, '（空对象 = 没有错误）');

console.log('\n第 3 题完成。');
