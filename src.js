let makeWrap=(target,intFn)=>{
    let active = true
    let ROOT = {children: []};
    let step = 0
    
    let log=(node, op, args)=>{
        let list = args.filter(e=>!e || !["object","function"].includes(typeof e)).map(e=>String(e))
        op = `${op}(${list})`
        let child = {op, args, step, children: []};
        node.children.push(child);
        return child;
    }
    
    let wrap=(input, node=ROOT)=>{
        let handler = Object.fromEntries(
            Reflect.ownKeys(Reflect).map(op=>[op,(...args)=>{
                try{
                    let output = Reflect[op](...args)
                    let child = log(node, op, args);
                    let event = {input, op, args, output};
                    let int = intFn?.(event,step,node)
                    
                    if (op == "get") {let desc = Reflect.getOwnPropertyDescriptor(...args);if (desc && !desc.configurable && !desc.writable) {return desc.value}}
                    if (op == "getPrototypeOf" && !Reflect.isExtensible(...args)) {return Reflect.getPrototypeOf(...args)}
                    if (op == "isExtensible") {return Reflect.isExtensible(...args)}
                    
                    return wrap(int ?? event.output, child);
                }finally{
                    step++
                    active = true
                }
            }])
        )
        
        let PROXY_HANDLE = new Proxy({},{
            get(_,key){
                try{return active?handler[key]:void 0}finally{active = false}
            }
        })

        try{return new Proxy(input,PROXY_HANDLE)}catch{return input}
    }
    let ALL = wrap(target)

    return {
        target,
        get step(){return step},
        log:ROOT,
        proxy:ALL,
        wrap
    }
}

let T = [1, 2, 3, 4];

let Logger = makeWrap(T, (event, step, node) => {});

try {Reflect.apply(
    Array.prototype.splice,
    Logger.proxy,
    [1, 2, 99]
)} catch {}

console.log(Logger.log)
