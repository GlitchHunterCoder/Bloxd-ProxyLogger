# Bloxd-ProxyLogger

> [!NOTE]
> This project is complete, little to no edits will be made to this

```js
let T = [1, 2, 3, 4]; //your target

let Logger = makeWrap(T, (event, step, node) => {
    // Intercept callback
});

//apply your operations
try {Reflect.apply(
    Array.prototype.splice,
    Logger.proxy,
    [1, 2, 99]
)} catch {}

// log your result
console.log(Logger.log)
```
## Docs
```js
/**
 * Makes the Logger
 * @param {target} the target of your proxy
 * @param {intFn} the interception function
 * @returns { {
      target, //target you input
      get step, //a getter to what step of proxy is at (explained later)
      log, //log of all operations, nested
      proxy, //proxy itself
      wrap, //the wrap function which creates proxy
  } }
 */
makeFn(target: any, intFn: function): object

/**
 * the interception function, note that you can intercept the callbacks but you can also edit any of the params directly, that is intentional
 * @callback
 * @param {event} = { {
     input, //input to the proxy
     op, //the operation which occured to proxy
     args, //args from proxy handler
     output //Reflect output it would send
 } }
 * @param {step} a getter to current step of an operation, used so you can time interception not by signals from event, but directly from which step out you are at
 * @param {node} current part of `log` object you were at, useful for adding annotations directly at log as needed
 * @return {
     void, //if no return, then it defaults to wrapping `event.output` for result
     any //if non nullish return, then it will directly wrap your return value
 }
 */
intFn(event: object, step: number, node: object): any
```
