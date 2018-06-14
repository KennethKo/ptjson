# ptjson

A friend of mine has a large pile of json driving some kind of Angular UI, but it's got a lot of redundancy in it. Common attributes, like button properties, get duplicated throughout the code and make his JSON unreadably long. It'd be easier to pack these common attributes into a common prototype object.

JSON already has a decycle utitlity that actually dereferences all object references into reserved "{$ref:<JSONPath>}" objects. A utility that packs and unpacks __proto__ into a materialized $protoref property would make the proto object itself also JSON serializable.

```
// Abriviated usage:
var obj = JSON.parse(json);
var minJson = PTJSON.stringify(obj);  // NOTE - munges obj. 
// If you want to create a deep clone, invoke objClone = JSON.decycle(obj)
var restoredObj = PTJSON.parse(minJSON);
```

TODO

--https://github.com/douglascrockford/JSON-js/blob/master/json2.js

--https://github.com/douglascrockford/JSON-js/blob/master/cycle.js

--stringify, parse - DONE

--protopack, deprotopack - DONE

---add prototypeLibrary functionality - DONE

--shallowify, deshalowify - DONE

--prototypify, deprototypify - DONE

---add override detection when scoring prototype parents by their footprint

---add support for existing prototypes when applying prototypify
