/**
 * 第 10 章 第五关 · 第 5 题参考答案：把一个 JS 模块迁移到 TS
 *
 * 运行：node answers/a5-migrate.ts
 */

console.log('========== 第 5 题：JS 模块迁移到 TS ==========');

/**
 * 按 keyFn 的返回值分组。
 *
 * 泛型设计：
 * - T：元素类型
 * - K：分组键类型，约束成 PropertyKey（string | number | symbol），因为要当对象键用
 * 返回类型 Record<K, T[]>，调用方能精确知道键和值的类型。
 */
export function groupBy<T, K extends PropertyKey>(
  items: readonly T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    const bucket = result[key];
    if (bucket) {
      bucket.push(item);
    } else {
      result[key] = [item];
    }
  }
  return result;
}

/**
 * 去掉指定的键，返回类型精确到"剩下的键"。
 *
 * 实现说明：这里必须有一处 as —— TypeScript 无法在编译期证明
 * delete 之后对象的形状。这正是"类型系统不健全"的一个具体体现，
 * 所以断言要写在这一处唯一的边界上。
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> {
  // 第一处 as：把泛型对象看成"字符串键的字典"，才能安全地 delete
  const result = { ...obj } as Record<string, unknown>;
  for (const key of keys) {
    delete result[key as string];
  }
  return result as Omit<T, K>;
}

// ---- 验证 ----
interface Person {
  name: string;
  age: number;
  city: string;
}

const people: Person[] = [
  { name: 'Tom', age: 18, city: '北京' },
  { name: 'Jerry', age: 18, city: '上海' },
  { name: 'Spike', age: 20, city: '北京' },
];

// groupBy：按数字键分组 → Record<number, Person[]>
const byAge = groupBy(people, (p) => p.age);
console.log('  按年龄分组，键:', Object.keys(byAge).join(','));
console.log('  18 岁的人:', byAge[18]?.map((p) => p.name).join(', '));

// groupBy：按字符串键分组 → Record<string, Person[]>
const byCity = groupBy(people, (p) => p.city);
console.log('  按城市分组，键:', Object.keys(byCity).join(','));
console.log('  北京的人:', byCity['北京']?.map((p) => p.name).join(', '));

// omit：返回类型 Omit<Person, 'city'>
const withoutCity = omit(people[0]!, ['city']);
console.log('  去掉 city 后:', withoutCity);
// console.log(withoutCity.city);   // ❌ TS2339：city 已经被去掉了

// omit 多个键
const onlyName = omit(people[0]!, ['city', 'age']);
console.log('  只留 name:', onlyName);

console.log('\n第 5 题完成。');
