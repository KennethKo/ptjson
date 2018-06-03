# ptjson

A friend of mine has a large pile of json driving some kind of Angular UI, but it's got a lot of redundancy in it. Common properties, like button properties, get duplicated throughout the code and make his JSON unreadably long.

JSON already has a decycle utitlity that actually dereferences all object references into reserved "{$ref:<JSONPath>}" objects. A utility that packs and unpacks __proto__ into a materialized $protoref property would make the proto object itself also JSON serializable.
  
TODO

-Set up atom? Is vi enough for me?

-Set up desktop remote server?


--https://github.com/douglascrockford/JSON-js/blob/master/json2.js

--https://github.com/douglascrockford/JSON-js/blob/master/cycle.js

--protopack, deprotopack

--prototypify, deprototypify


-Work out logic for prototype-ifying JS objects exact redundencies.

-Work out logic for prototype-ifying JS objects with approximate redundancies paired with overrides. Do a bit of huffman research, but 
more likely some kind of center-finding refresher? Could be more naive than that.




