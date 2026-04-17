let LOG = [];
let seen = new WeakMap();
let UNWRAP   = Symbol('unwrap');
let IS_PROXY = Symbol('isProxy');

let unwrap = v => v?.[UNWRAP] ?? v;

// All 13 Proxy traps — default: log and forward to Reflect
let TRAPS = [
  'get', 'set', 'has', 'deleteProperty', 'apply', 'construct',
  'ownKeys', 'getOwnPropertyDescriptor', 'defineProperty',
  'getPrototypeOf', 'setPrototypeOf', 'isExtensible', 'preventExtensions',
];

function wrap(value, path) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (seen.has(value)) return seen.get(value);
  
  let handler = Object.fromEntries(TRAPS.map(trap => [trap, (...args) => {
    LOG.push({ op: trap, path, args: args.slice(1) });
    return Reflect[trap](...args);
  }]));
  
  handler.get = (target, prop, receiver) => {
    if (prop === UNWRAP)   return value;
    if (prop === IS_PROXY) return true;
    LOG.push({ op: 'get', path, args: [prop] });
    let result = Reflect.get(target, prop, receiver);
    let desc = Object.getOwnPropertyDescriptor(target, prop);
    if (desc && !desc.configurable) return result;
    return wrap(result, `${path}.${String(prop)}`);
  };
  
  handler.set = (target, prop, newVal) => {
    LOG.push({ op: 'set', path, args: [prop, unwrap(newVal)] });
    return Reflect.set(target, prop, unwrap(newVal));
  };
  
  handler.apply = (target, thisArg, args) => {
    let unwrappedArgs = args.map(unwrap);
    LOG.push({ op: 'apply', path, args: unwrappedArgs });
    return wrap(Reflect.apply(target, unwrap(thisArg), unwrappedArgs), `${path}()`);
  };
  
  handler.construct = (target, args, newTarget) => {
    let unwrappedArgs = args.map(unwrap);
    LOG.push({ op: 'construct', path, args: unwrappedArgs });
    return wrap(Reflect.construct(target, unwrappedArgs, unwrap(newTarget)), `new ${path}`);
  };

  let proxy = new Proxy(value, handler);
  seen.set(value, proxy);
  return proxy;
}
