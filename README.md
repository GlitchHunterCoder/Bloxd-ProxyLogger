# Bloxd-ProxyLogger
```js
const testObj = {
  x: 10,
  y: 20,
  sum() {
    return this.x + this.y;
  },
  nested: {
    a: 1,
    b: 2,
  }
};

// Create the logging proxy
const proxy = createLoggingProxy(testObj, "testObj");

// Access some properties
proxy.x;
proxy.y;

// Call a method
proxy.sum();

// Access nested object
proxy.nested.a;
proxy.nested.b;

// Print the call tree

const callTree = getCallTree(proxy); // from your small testObj proxy

console.log(JSON.stringify(callTree, null, 2));
console.log("\n------\n")
console.log(jsonToTree(callTree))
```
