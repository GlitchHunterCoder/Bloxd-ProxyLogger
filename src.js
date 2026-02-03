// deep-logger-safe.js
function createLoggingProxy(rootValue, label = "root", options = { hugeTree: true }) {
  const originalToProxy = new WeakMap();
  const proxyToOriginal = new WeakMap();
  const methodProxyCache = new WeakMap();
  const primitiveBoxCache = new Map();

  const hugeTree = Boolean(options.hugeTree);
  const sharedRoot = { label: String(label), type: typeof rootValue, children: []};
  const sharedStack = [sharedRoot];

  const maybeUnwrap = (v) => proxyToOriginal.get(v) ?? v;

  function boxed(value) {
    if (value === null || value === undefined) return Object(value);
    const t = typeof value;
    if (t === 'object' || t === 'function') return value;
    if (!primitiveBoxCache.has(value)) primitiveBoxCache.set(value, Object(value));
    return primitiveBoxCache.get(value);
  }

  function isNonConfigurable(base, prop) {
    const desc = Object.getOwnPropertyDescriptor(base, prop);
    return desc && desc.configurable === false;
  }

  function makeLogger(value, lbl = label, parentRoot = null, parentStack = null) {
    if ((typeof value === 'object' || typeof value === 'function') && originalToProxy.has(value)) {
      return originalToProxy.get(value);
    }

    const localRoot = hugeTree ? sharedRoot : { label: String(lbl), type: typeof value, children: []};
    const localStack = hugeTree ? sharedStack : [localRoot];

    function currentNode() { return localStack[localStack.length - 1]; }
    function pushNode(node) { currentNode().children.push(node); localStack.push(node); }
    function popNode() { localStack.pop(); }
    function makeNode(action, detail) { return { action, detail, children: []}; }

    function wrapReturned(v, subLabel) {
      if (v === null || (typeof v !== 'object' && typeof v !== 'function')) return v;
      return makeLogger(v, subLabel, localRoot, localStack);
    }

    const handler = {
      get(target, prop, receiver) {
        if (prop === '__callTree') return localRoot;

        const node = makeNode('get', String(prop));
        pushNode(node);
        try {
          if (prop === Symbol.toPrimitive) {
            return (hint) => {
              const primNode = makeNode('toPrimitive', hint);
              pushNode(primNode);
              try { return value; } finally { popNode(); }
            };
          }

          const base = (typeof value === 'object' || typeof value === 'function') ? value : boxed(value);
          const result = Reflect.get(base, prop, base);

          if (isNonConfigurable(base, prop)) return result;

          if (typeof result === 'function') {
            const originalFn = result;
            if (methodProxyCache.has(originalFn)) return methodProxyCache.get(originalFn);

            // --- MULTI-TRY WRAPPING ---
            let fnProxy;
            const wrapAttempts = [
              () => wrapReturned(result.bind(base), `${lbl}.${String(prop)}()`),
              () => wrapReturned(result.bind(maybeUnwrap(base)), `${lbl}.${String(prop)}()`),
            ];
            for (const attempt of wrapAttempts) {
              try { fnProxy = attempt(); break; } catch {}
            }
            // fallback A: raw function if wrapping fails
            if (!fnProxy) fnProxy = result;

            try { methodProxyCache.set(originalFn, fnProxy); } catch {}
            return fnProxy;
          }

          if ((typeof result === 'object' || typeof result === 'function') && originalToProxy.has(result)) {
            return originalToProxy.get(result);
          }

          return wrapReturned(result, `${lbl}.${String(prop)}`);
        } finally {
          popNode();
        }
      },

      set(target, prop, newVal) {
        const node = makeNode('set', { prop: String(prop), newVal });
        pushNode(node);
        try {
          const base = (typeof value === 'object' || typeof value === 'function') ? value : boxed(value);
          return Reflect.set(base, prop, maybeUnwrap(newVal), base);
        } finally { popNode(); }
      },

      has(target, prop) { const node = makeNode('has', String(prop)); pushNode(node); try { return Reflect.has((typeof value === 'object' || typeof value === 'function') ? value : boxed(value), prop); } finally { popNode(); } },
      deleteProperty(target, prop) { const node = makeNode('deleteProperty', String(prop)); pushNode(node); try { return Reflect.deleteProperty((typeof value === 'object' || typeof value === 'function') ? value : boxed(value), prop); } finally { popNode(); } },
      ownKeys(target) { const node = makeNode('ownKeys', null); pushNode(node); try { return Reflect.ownKeys((typeof value === 'object' || typeof value === 'function') ? value : boxed(value)); } finally { popNode(); } },
      getOwnPropertyDescriptor(target, prop) { const node = makeNode('getOwnPropertyDescriptor', String(prop)); pushNode(node); try { return Reflect.getOwnPropertyDescriptor((typeof value === 'object' || typeof value === 'function') ? value : boxed(value), prop); } finally { popNode(); } },
      defineProperty(target, prop, descriptor) { const node = makeNode('defineProperty', { prop: String(prop), descriptor }); pushNode(node); try { return Reflect.defineProperty((typeof value === 'object' || typeof value === 'function') ? value : boxed(value), prop, descriptor); } finally { popNode(); } },
      getPrototypeOf(target) { const node = makeNode('getPrototypeOf', null); pushNode(node); try { return Reflect.getPrototypeOf((typeof value === 'object' || typeof value === 'function') ? value : boxed(value)); } finally { popNode(); } },
      setPrototypeOf(target, proto) { const node = makeNode('setPrototypeOf', proto); pushNode(node); try { return Reflect.setPrototypeOf((typeof value === 'object' || typeof value === 'function') ? value : boxed(value), proto); } finally { popNode(); } },
      isExtensible(target) { const node = makeNode('isExtensible', null); pushNode(node); try { return Reflect.isExtensible((typeof value === 'object' || typeof value === 'function') ? value : boxed(value)); } finally { popNode(); } },
      preventExtensions(target) { const node = makeNode('preventExtensions', null); pushNode(node); try { return Reflect.preventExtensions((typeof value === 'object' || typeof value === 'function') ? value : boxed(value)); } finally { popNode(); } },

      apply(target, thisArg, argList) { const node = makeNode('apply', { thisArg, argList }); pushNode(node); try { const res = Reflect.apply(value, maybeUnwrap(thisArg), argList.map(maybeUnwrap)); return (res === null || (typeof res !== 'object' && typeof res !== 'function')) ? res : wrapReturned(res, `${lbl}() result`); } finally { popNode(); } },
      construct(target, argList, newTarget) { const node = makeNode('construct', { argList }); pushNode(node); try { const res = Reflect.construct(value, argList.map(maybeUnwrap), maybeUnwrap(newTarget)); return (res === null || (typeof res !== 'object' && typeof res !== 'function')) ? res : wrapReturned(res, `new ${lbl}`); } finally { popNode(); } }
    };

    const proxyTarget = (typeof value === 'object' || typeof value === 'function') ? value : boxed(value);
    const proxy = new Proxy(proxyTarget, handler);

    if (typeof value === 'object' || typeof value === 'function') {
      try { originalToProxy.set(value, proxy); } catch (e) {}
    }
    proxyToOriginal.set(proxy, value);

    Object.defineProperty(proxy, '__callTree', {
      configurable: false,
      enumerable: false,
      get() { return localRoot; }
    });

    return proxy;
  }

  return makeLogger(rootValue, label);
}

function getCallTree(proxy) {
  return proxy?.__callTree ?? null;
}

function jsonToTree(node, indent = "") {
  if (!node) return "";

  let lines = [];

  // Node title
  const baseTitle = node.label ? `${node.label} (${node.type})` : node.action;
  lines.push(indent + baseTitle);

  // Recurse into detail safely
  if (node.detail !== undefined) {
    if (node.detail && typeof node.detail === "object") {
      for (const [k, v] of Object.entries(node.detail)) {
        if (v && typeof v === "object") {
          lines.push(indent + "  " + k + ":");
          // Recursive call: wrap object into a pseudo-node to print
          lines.push(jsonToTree({ label: null, type: typeof v, children: [], detail: v }, indent + "    "));
        } else if (typeof v === "function") {
          lines.push(indent + "  " + k + ": [Function]");
        } else {
          lines.push(indent + "  " + k + ": " + v);
        }
      }
    } else if (typeof node.detail === "function") {
      lines.push(indent + "  detail: [Function]");
    } else {
      lines.push(indent + "  detail: " + node.detail);
    }
  }

  // Recurse into children
  if (node.children && node.children.length) {
    for (const child of node.children) {
      lines.push(jsonToTree(child, indent + "  "));
    }
  }

  return lines.join("\n");
}
