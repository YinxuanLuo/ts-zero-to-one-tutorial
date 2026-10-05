// ============================================================
// 07-类与模块.ts —— 第 07 章配套可运行示例
//
// 运行方式（在 examples 目录下）：
//   node 07-类与模块.ts            ← Node 原生类型擦除，直接跑
//   pnpm exec tsc --noEmit         ← 类型检查
//
// 注意：本文件刻意没有使用 enum、namespace、构造函数参数属性，
// 因为 Node 的 strip-only 模式不支持这三种"带运行时语义"的语法，
// 用了就必须加 --experimental-transform-types 才能跑。
// 详见正文 A.3 小节。
// ============================================================

// ---------- 模块导入部分 ----------
// verbatimModuleSyntax: true 时，只导入类型必须写 import type，
// 否则 tsc 会报 TS1484。下面这行是"值 + 类型混着导"的标准写法。
import { formatPrice, VERSION, Counter, type Currency, type Product } from './07-lib.ts';

/** 小工具：把一行输出和标题分开，纯粹为了控制台好看 */
const hr = (title: string): void => {
  console.log(`\n===== ${title} =====`);
};

hr('1. 四种可见性修饰符');

class Employee {
  public name: string; // 默认就是 public，写出来只是给别人看的
  private salary: number; // 只有类内部能碰
  protected department: string; // 自己和子类能碰，外部不行
  readonly id: string; // 只能在声明处或构造函数里赋值，之后是只读

  constructor(name: string, salary: number, department: string, id: string) {
    this.name = name; // 显式赋值：这是"没写参数属性简写"的版本
    this.salary = salary;
    this.department = department;
    this.id = id;
  }

  public describe(): string {
    return `${this.name} 在 ${this.department}，工号 ${this.id}`;
  }

  /** 类的内部方法当然可以读 private */
  public giveRaise(percent: number): number {
    this.salary = Math.round(this.salary * (1 + percent / 100));
    return this.salary;
  }
}

class Manager extends Employee {
  /** 子类可以读 protected 成员 */
  public leadTeam(): string {
    return `${this.name} 管理 ${this.department}`;
    // return this.salary;  // ❌ 子类也读不到 private
  }
}

const alice = new Employee('Alice', 20000, '研发部', 'E-001');
console.log(alice.describe());
console.log('涨薪后:', alice.giveRaise(10));
console.log('public 成员外部可读:', alice.name);

const bob = new Manager('Bob', 30000, '平台部', 'M-001');
console.log(bob.leadTeam());

// readonly 在类型层面挡住了二次赋值。
// 打开下面这行，tsc 会报：TS2540: Cannot assign to 'id' because it is a read-only property.
// alice.id = 'E-999';
//
// 但注意：它只是编译期的锁。用 as any 绕过去，运行时照样改得动：
(alice as { id: string }).id = 'E-HACKED';
console.log('readonly 被类型断言绕过后的 id:', alice.id);

hr('2. TS 的 private 是编译期的约定，拦不住运行时');

class SecretBox {
  private secret = 'TS 的 private 秘密';

  read(): string {
    return this.secret;
  }
}

const box = new SecretBox();
console.log('正常读取:', box.read());

// 下面这行过不了类型检查（真实报错见正文）：
// console.log(box.secret);
// TS2339: Property 'secret' does not exist on type 'SecretBox'.

// 但编译期一过，运行时它就只是个普通属性，裸奔：
console.log('用 as any 强行读:', (box as any).secret);
console.log(
  '运行时检测 Object.keys:', // 它真的在实例上
  Object.keys(box).join(', '),
);

hr('3. JS 原生 # 私有字段：运行时真的拦得住');

class RealPrivateBox {
  #secret = '真·私有秘密';

  read(): string {
    return this.#secret;
  }
}

const realBox = new RealPrivateBox();
console.log('正常读取:', realBox.read());

// 类型层面读不到：
// console.log(realBox.#secret);
// TS18013: Property '#secret' is not accessible outside class 'RealPrivateBox' because it has a private identifier.

// 运行时也读不到 —— 这不是类型系统吓唬你，是 JS 引擎本身不让。
// 关键：#secret 甚至不是一个"属性名"，语法层面就不允许在类外面写 #secret，
// 所以下面这段只能把类内部的方法偷出来当普通函数调用（真实项目里没人这么干，
// 这里只是为了让你亲眼看到"引擎会抛错"）。
const stolen = (RealPrivateBox.prototype as any).read as () => string;
try {
  stolen.call({}); // this 换成了一个普通空对象
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log('❌ 运行时真的抛错了:', message);
}

// 更硬核的一点：#secret 根本不是实例的自有属性，JS 的反射 API 全都看不见它
console.log('实例自有属性名:', JSON.stringify(Object.getOwnPropertyNames(realBox)));
console.log('Object.keys 里没有它:', JSON.stringify(Object.keys(realBox)));
// 对比一下 TS 的 private：它是真属性，只是名字在类型层面被藏起来了
console.log('TS private 的自有属性名:', JSON.stringify(Object.getOwnPropertyNames(box)));

hr('4. 抽象类 + 多态：形状面积计算器');

/**
 * 抽象类 = 一份"半成品模板"。
 * 它声明了"子类必须有什么"（抽象方法），同时给出了"所有子类都能用的东西"（具体方法）。
 * 注意：抽象类不能被 new —— 它是模板，不是产品。
 *
 * 这里刻意用"显式属性声明 + 构造函数里赋值"的写法，
 * 而没有用 constructor(public readonly name: string) 这种参数属性简写，
 * 因为 node 直接跑 .ts 时参数属性属于"不可擦除语法"。正文 A.3 有详细对比。
 */
abstract class Shape {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract area(): number; // 抽象方法：只给签名，不给实现

  /** 具体方法：所有子类直接继承（这就是模板方法模式的"模板"） */
  describe(): string {
    return `${this.name}(${this.detail()}) 的面积是 ${this.area().toFixed(2)}`;
  }

  /** 子类可以补一句自己的说明，不补就用默认值 —— 这就是"钩子方法" */
  protected detail(): string {
    return '通用形状';
  }
}

class Circle extends Shape {
  readonly #radius: number;

  constructor(radius: number) {
    super('圆形'); // 子类构造函数必须先调用 super，然后才能碰 this
    this.#radius = radius;
  }

  override area(): number {
    return Math.PI * this.#radius * this.#radius;
  }

  protected override detail(): string {
    return `半径 ${this.#radius}`;
  }
}

class Rect extends Shape {
  readonly #width: number;
  readonly #height: number;

  constructor(width: number, height: number) {
    super('矩形');
    this.#width = width;
    this.#height = height;
  }

  override area(): number {
    return this.#width * this.#height;
  }

  protected override detail(): string {
    return `${this.#width} × ${this.#height}`;
  }
}

const shapes: Shape[] = [new Circle(3), new Rect(4, 5)];
for (const shape of shapes) {
  console.log(shape.describe()); // 同一句代码，不同结果 —— 这就是多态
}

hr('5. implements vs extends + 接口描述形状');

interface Printable {
  print(): string;
}

/** extends Shape 是"继承实现"，implements Printable 是"承诺接口" */
class Square extends Shape implements Printable {
  readonly #side: number;

  constructor(side: number) {
    super('正方形');
    this.#side = side;
  }

  override area(): number {
    return this.#side ** 2;
  }

  protected override detail(): string {
    return `边长 ${this.#side}`;
  }

  print(): string {
    return `[正方形 边长${this.#side}]`;
  }
}

const square = new Square(6);
console.log(square.describe());
console.log(square.print());
console.log('square 是 Shape 吗:', square instanceof Shape);
// 注意：下面这行在类型层面是错的，但你自己写的类可以用 instanceof ——
// 详见正文面试第 8 问"为什么类型不能 instanceof"。
// console.log(square instanceof Printable);
// TS2693: 'Printable' only refers to a type, but is being used as a value here.

hr('6. getter / setter / 静态成员 / static 块');

class Temperature {
  /** 内部统一用摄氏度存储 */
  #celsius = 0;

  static readonly ABSOLUTE_ZERO = -273.15;

  /** static 块：类第一次被求值时就跑，适合做复杂初始化 */
  static {
    console.log('[static 块] Temperature 类被加载了，this 就是类本身:', Temperature.ABSOLUTE_ZERO);
  }

  static fromFahrenheit(f: number): Temperature {
    const t = new Temperature();
    t.celsius = ((f - 32) * 5) / 9;
    return t;
  }

  get celsius(): number {
    return this.#celsius;
  }

  set celsius(value: number) {
    if (value < Temperature.ABSOLUTE_ZERO) {
      throw new RangeError(`温度不能低于绝对零度 ${Temperature.ABSOLUTE_ZERO}`);
    }
    this.#celsius = value;
  }

  get fahrenheit(): number {
    return this.#celsius * 1.8 + 32;
  }
}

const t = new Temperature();
t.celsius = 25; // 走 setter
console.log('摄氏:', t.celsius, '华氏:', t.fahrenheit.toFixed(1));
console.log('静态工厂:', Temperature.fromFahrenheit(212).celsius.toFixed(1));

try {
  t.celsius = -300; // setter 里的校验会拦下来
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log('❌ setter 校验:', message);
}

hr('7. 泛型类（复习：泛型在类上的用法）');

class Box<T> {
  #items: T[] = [];

  add(item: T): this {
    // 返回 this 而不是 Box<T>，是为了让子类链式调用时类型不丢
    this.#items.push(item);
    return this;
  }

  get all(): readonly T[] {
    return this.#items;
  }

  first(): T | undefined {
    return this.#items[0];
  }
}

const nums = new Box<number>().add(1).add(2).add(3);
console.log('数字盒子:', nums.all.join('+'), '首个:', nums.first());

const strs = new Box<string>();
strs.add('a');
console.log('字符串盒子首个:', strs.first());
// strs.add(1);  // ❌ TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.

hr('8. 实战：抽象类 + 多态写一个支付渠道');

/** 用 as const 对象代替 enum —— 擦除友好，运行时还真实存在 */
const Channel = {
  Wechat: 'wechat',
  Alipay: 'alipay',
  Balance: 'balance',
} as const;
type Channel = (typeof Channel)[keyof typeof Channel]; // 'wechat' | 'alipay' | 'balance'

interface PayResult {
  ok: boolean;
  tradeNo: string;
  message: string;
}

abstract class PayChannel {
  abstract readonly kind: Channel;
  abstract readonly displayName: string;

  /** 模板方法：定义了支付流程的骨架，具体每一步交给子类 */
  async pay(amount: number): Promise<PayResult> {
    if (amount <= 0) {
      return { ok: false, tradeNo: '', message: '金额必须大于 0' };
    }
    const tradeNo = await this.doPay(amount);
    return {
      ok: true,
      tradeNo,
      message: `${this.displayName} · 支付成功 ${formatPrice(amount, 'CNY')}`,
    };
  }

  /** 只有子类知道怎么扣钱 */
  protected abstract doPay(amount: number): Promise<string>;
}

let seq = 0;
const nextTradeNo = (prefix: string): string => `${prefix}${Date.now()}${++seq}`;

class WechatPay extends PayChannel {
  readonly kind = Channel.Wechat;
  readonly displayName = '微信支付';

  protected override async doPay(amount: number): Promise<string> {
    console.log(`  [扫码] 唤起微信收银台，金额 ${amount}`);
    return nextTradeNo('WX');
  }
}

class AlipayPay extends PayChannel {
  readonly kind = Channel.Alipay;
  readonly displayName = '支付宝';

  protected override async doPay(amount: number): Promise<string> {
    console.log(`  [跳转] 唤起支付宝，金额 ${amount}`);
    return nextTradeNo('ALI');
  }
}

class BalancePay extends PayChannel {
  readonly kind = Channel.Balance;
  readonly displayName = '余额';

  #balance: number;

  constructor(balance: number) {
    super();
    this.#balance = balance;
  }

  protected override async doPay(amount: number): Promise<string> {
    if (amount > this.#balance) {
      throw new Error(`余额不足，当前 ${this.#balance}`);
    }
    this.#balance -= amount;
    console.log(`  [扣减] 余额扣款 ${amount}，剩余 ${this.#balance}`);
    return nextTradeNo('BAL');
  }
}

/** 调用方只依赖抽象，完全不知道具体是哪个渠道 —— 开闭原则 */
const checkout = async (channel: PayChannel, amount: number): Promise<void> => {
  try {
    const result = await channel.pay(amount);
    console.log(result.ok ? `✅ ${result.message}，单号 ${result.tradeNo}` : `❌ ${result.message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${channel.displayName} · 支付失败: ${message}`);
  }
};

await checkout(new WechatPay(), 199);
await checkout(new AlipayPay(), 299);
await checkout(new BalancePay(500), 100);
await checkout(new BalancePay(10), 100);
await checkout(new WechatPay(), -5);

hr('9. 模块：值导入 / 类型导入 / 声明文件的味道');

const product: Product = {
  id: 'P-1001',
  name: '机械键盘',
  price: 399,
  currency: 'CNY',
};
console.log('lib 的 VERSION:', VERSION);
console.log('格式化价格:', formatPrice(product.price, product.currency));

// 货币类型是 lib 里导出的联合类型，传错会被抓住：
// formatPrice(10, 'GBP');
// TS2345: Argument of type '"GBP"' is not assignable to parameter of type 'Currency'.

const counter = new Counter();
counter.increment();
counter.increment();
console.log('lib 里的 Counter:', counter.value);

hr('10. import type 为什么必须存在（运行时完全消失）');

// 这一句是"值导入"：Node 真的会去加载 07-lib.ts
import { add } from './07-lib.ts';
console.log('值导入 add(1,2):', add(1, 2));

// 这一句是"纯类型导入"：编译/擦除后，这一行一个字节都不剩。
// 删掉它也不影响任何运行时行为 —— 因为它本来就只服务于类型检查。
console.log('类型导入 Currency 只是类型，运行时不存在（这里只能当字符串用）:', 'CNY' satisfies Currency);

hr('完成');

// 允许顶层 await：本文件是 ESM，package.json 里 "type": "module"
