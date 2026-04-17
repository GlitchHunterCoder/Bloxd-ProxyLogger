const UNWRAP   = Symbol('unwrap');
const IS_PROXY = Symbol('isProxy');

const unwrap = v => v?.[UNWRAP] ?? v;

const TRAPS = [
  'get', 'set', 'has', 'deleteProperty', 'apply', 'construct',
  'ownKeys', 'getOwnPropertyDescriptor', 'defineProperty',
  'getPrototypeOf', 'setPrototypeOf', 'isExtensible', 'preventExtensions',
];

const seen = new WeakMap();

function wrap(value, path = 'root', parentNode = null) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (seen.has(value)) return seen.get(value);

  const node = { label: path, type: typeof value, children: [] };
  if (parentNode) parentNode.children.push(node);
  else LOG.children.push(node); // top-level nodes attach to the global LOG root

  const log = (op, args) => {
    const entry = { op, args, children: [] };
    node.children.push(entry);
    return entry;
  };

  const handler = Object.fromEntries(TRAPS.map(trap => [trap, (...args) => {
    log(trap, args.slice(1));
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
    log('set', [prop, unwrap(newVal)]);
    return Reflect.set(target, prop, unwrap(newVal));
  };

  handler.apply = (target, thisArg, args) => {
    const unwrappedArgs = args.map(unwrap);
    const entry = log('apply', unwrappedArgs);
    const result = Reflect.apply(target, unwrap(thisArg), unwrappedArgs);
    return wrap(result, `${path}()`, entry);
  };

  handler.construct = (target, args, newTarget) => {
    const unwrappedArgs = args.map(unwrap);
    const entry = log('construct', unwrappedArgs);
    const result = Reflect.construct(target, unwrappedArgs, unwrap(newTarget));
    return wrap(result, `new ${path}`, entry);
  };

  const proxy = new Proxy(value, handler);
  seen.set(value, proxy);
  return proxy;
}

const LOG = { label: '__root__', children: [] };
