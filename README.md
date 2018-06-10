# ptjson

A friend of mine has a large pile of json driving some kind of Angular UI, but it's got a lot of redundancy in it. Common attributes, like button properties, get duplicated throughout the code and make his JSON unreadably long. It'd be easier to pack these common attributes into a common prototype object.

JSON already has a decycle utitlity that actually dereferences all object references into reserved "{$ref:<JSONPath>}" objects. A utility that packs and unpacks __proto__ into a materialized $protoref property would make the proto object itself also JSON serializable.
  
TODO

--https://github.com/douglascrockford/JSON-js/blob/master/json2.js

--https://github.com/douglascrockford/JSON-js/blob/master/cycle.js

--protopack, deprotopack - DONE

--shallowify, deshalowify - DONE

--prototypify, deprototypify

---Work out logic for prototype-ifying JS objects with approximate redundancies paired with overrides. Collect key-value pairs on shallow reference comparisons, collecting into "set" objects.

---Sets with lots of overlap are easy to collapse, but sets with marginal overlap tend to get n^2. Could optimize a bit w/ a master-map, checking for prelim overlap before checking each distinct set.

---What to do when the AB intersect, BC intersect, and AC intersect all exceed the threshold necessary for prototypification, but the ABC intersect does not? Is this... a negative keys question? Not quite, since the misses could be wrong values within keys as well. Hm.

