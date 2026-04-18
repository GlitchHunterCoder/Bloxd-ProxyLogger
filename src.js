const UNWRAP   = Symbol('unwrap');
const IS_PROXY = Symbol('isProxy');

const unwrap = v => v?.[UNWRAP] ?? v;

const safe = v => {
    if (v === null) return null;
    if (typeof v === 'undefined') return undefined;
    if (v === globalThis) return '[globalThis]';
    if (typeof v === 'function') return `[Function: ${v.name || 'anonymous'}]`;
    if (typeof v !== 'object') return v;
    return `[object ${v?.constructor?.name ?? 'Object'}]`;
};

const TRAPS = [
  'get', 'set', 'has', 'deleteProperty', 'apply', 'construct',
  'ownKeys', 'getOwnPropertyDescriptor', 'defineProperty',
  'getPrototypeOf', 'setPrototypeOf', 'isExtensible', 'preventExtensions',
];

const LOG = { label: 'PROXY_LOGGER', children: [] };

const seen = new WeakMap();

function wrap(value, path = 'root', parentNode = null) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (seen.has(value)) return seen.get(value);

  const node = { label: path, type: typeof value, children: [] };
  if (parentNode) parentNode.children.push(node);
  else LOG.children.push(node);

  const log = (op, args) => {
    const entry = { op, args, children: [] };
    node.children.push(entry);
    return entry;
  };

  const handler = Object.fromEntries(TRAPS.map(trap => [trap, (...args) => {
      log(trap, args.slice(1).map(safe));
      return Reflect[trap](...args);
  }]));

  handler.get = (target, prop, receiver) => {
      if (prop === UNWRAP)   return value;
      if (prop === IS_PROXY) return true;
      const entry = log('get', [prop]);
      const result = Reflect.get(target, prop, receiver);
      const desc = Object.getOwnPropertyDescriptor(target, prop);
      if (desc && !desc.configurable) return result;
      return wrap(result, `${path}.${String(prop)}`, entry);
  };

  handler.set = (target, prop, newVal) => {
      const unwrappedVal = unwrap(newVal);
      log('set', [prop, safe(unwrappedVal)]);
      return Reflect.set(target, prop, unwrappedVal);
  };

  handler.apply = (target, thisArg, args) => {
      const unwrappedArgs = args.map(unwrap);
      const unwrappedThis = unwrap(thisArg);
      const entry = log('apply', [safe(unwrappedThis), unwrappedArgs.map(safe)]);
      const result = Reflect.apply(target, unwrappedThis, unwrappedArgs);
      return wrap(result, `${path}()`, entry);
  };

  handler.construct = (target, args, newTarget) => {
      const unwrappedArgs = args.map(unwrap);
      const unwrappedTarget = unwrap(newTarget);
      const entry = log('construct', [unwrappedArgs.map(safe), safe(unwrappedTarget)]);
      const result = Reflect.construct(target, unwrappedArgs, unwrappedTarget);
      return wrap(result, `new ${path}`, entry);
  };

  const proxy = new Proxy(value, handler);
  seen.set(value, proxy);
  return proxy;
}
