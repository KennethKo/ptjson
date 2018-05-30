# ptjson

A friend of mine has a large pile of json driving some kind of Angular UI, but it's got a lot of redundancy in it. Common properties, like button properties, get duplicated throughout the code and make the JSON unreadable.

I don't see a reason why we couldn't tweak JSON stringify and parse to serialize __proto__ properties by reserving a few property names:
ptRef - reference name other JSON objects would use to refer to this object. ptRef should be the only property actually parsed into the JS object on parse.
ptDel - delegate prototype object, pointing to a protoRef of a sibling or uncle-ancestor (siblings of ancestor line), inheriting everything from the prototype except Proto<Properties>. Lowest priority, overridable within the object. 
ptExt - composition prototype object, absorbing all visible objects of the list of protoRefs. Last in wins.
ptLib - a collection of prototype JSON objects that aren't otherwise referenced elsewhere in the current object's tree.

TODO
-Set up docker local.
-Set up nodejs local
-Set up atom.
-Set up desktop remote server?

-What does existing parser do? Is js member iterator deterministic in order iteration?
--No. Property order is never guaranteed.
-Extend existing JSON library stringify and parse with special behavior around 4 reserved properties. 
--https://github.com/douglascrockford/JSON-js/blob/master/json2.js

-Work out default ptRef naming conventions for __proto__ objects that don't have a ptRef property defined.

-Work out logic for prototype-ifying JS objects exact redundencies.
--Actually somewhat handled by JSON.decycle. Didn't know it existed. Hm. Still, it only implements dereferencing for exact reference matches (using weakmap), and not value matches.
-Work out logic for prototype-ifying JS objects with approximate redundancies paired with overrides. Do a bit of huffman research, but more likely some kind of center-finding refresher? Could be more naive than that.
