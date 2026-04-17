# Bloxd-ProxyLogger
```js
//create the object to proxy
let root = {
  x: 42,
  greet(name) { return `hello ${name}`; },
  nested: { a: 1 },
}

//wrap the object, and give it a name
let obj = wrap(root, 'root');

 //perform your operations
obj.nested.a;
obj.greet('world');
obj.x = 99;
'nested' in obj;
delete obj.x;

//log the output
console.log(LOG);
```
