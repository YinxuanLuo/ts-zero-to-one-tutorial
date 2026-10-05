/**
 * 第 10 章 第五关 · 第 1 题参考答案：类型安全的事件总线
 *
 * 运行：node answers/a1-event-bus.ts
 */

console.log('========== 第 1 题：类型安全的事件总线 ==========');

type Handler<P> = (payload: P) => void;

interface EventBus<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
}

function createEventBus<Events extends Record<string, unknown>>(): EventBus<Events> {
  // 内部存储必须放宽成 Handler<never>：
  // 因为不同事件的负载类型不同，Map 的键无法表达"每个键对应自己的负载类型"。
  // 这是"用泛型做异构容器"时几乎躲不掉的一处妥协，读写两端各做一次断言把它关在内部。
  const handlers = new Map<keyof Events, Set<Handler<never>>>();

  function on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = handlers.get(event);
    if (!set) {
      set = new Set<Handler<never>>();
      handlers.set(event, set);
    }
    set.add(handler as Handler<never>);

    return () => {
      set?.delete(handler as Handler<never>);
    };
  }

  function emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      (handler as Handler<Events[K]>)(payload);
    }
  }

  return { on, emit };
}

// ---- 验证 ----
type MyEvents = {
  'user:login': { id: string };
  'cart:add': { itemId: string; qty: number };
};

const bus = createEventBus<MyEvents>();

const off = bus.on('user:login', (p) => {
  console.log('  登录:', p.id.toUpperCase()); // p 自动是 { id: string }
});
bus.emit('user:login', { id: 'u1' });
off();
bus.emit('user:login', { id: 'u2' }); // 已取消订阅，不输出

bus.on('cart:add', (p) => console.log('  加购:', p.itemId, 'x', p.qty));
bus.emit('cart:add', { itemId: 'sku-1', qty: 2 });

// 下面两行必须编译报错，解开注释验证：
// bus.emit('cart:add', { itemId: 'a' });   // TS2345：缺少 qty
// bus.on('nope', () => {});                // TS2345：'nope' 不是合法事件名

console.log('\n第 1 题完成。');
