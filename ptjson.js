/*
    ptjson.js
    2018-06-02
    Public Domain.
    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html
    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.
    'Inspired' by cycle.js - Javascript is by no means my first language.
    https://github.com/KennethKo/ptjson

    Example usage:

        rawJson = JSON.stringify(
                  JSON.decycle(
                    o
                  ), null, "    ");

        origO = JSON.retrocycle(
                JSON.parse(
                  rawJson
                ));

        minJson = JSON.stringify(
                  JSON.decycle(
                  PTJSON.protopack(
                  PTJSON.prototypify(
                  PTJSON.shallowify(
                    o
                  )))), null, "    ");

        unminO = PTJSON.unshallowify(
                 PTJSON.deprototypify(
                 PTJSON.protounpack(
                 JSON.retrocycle(
                 JSON.parse(
                   minJson
                 )))));

        unminJson = JSON.stringify(
                    JSON.decycle(
                      unminO
                    ), null, "    ");

*/


if (typeof PTJSON !== "object") {
    PTJSON = {};
}

if (typeof PTJSON.stringify !== "function") {
    PTJSON.stringify = function(o, replacer, space) {
        return JSON.stringify(
                JSON.decycle(
                PTJSON.protopack(
                // NOTE - object is perfectly usable at this stage
                PTJSON.prototypify(
                PTJSON.shallowify(
                    o
                )))), replacer, space);
    }
}

if (typeof PTJSON.parse !== "function") {
    PTJSON.parse = function(text, reviver) {
        return PTJSON.unshallowify(
                 PTJSON.deprototypify(
                 // NOTE - object is perfectly usable at this stage
                 PTJSON.protounpack(
                 JSON.retrocycle(
                 JSON.parse(
                   text
                 )))), reviver);
    }
}

if (typeof PTJSON._isJsonObj !== "function") {
    PTJSON._isJsonObj = function (object) {
        return (
            typeof object === "object"
            && object !== null
            && !(object instanceof Boolean)
            && !(object instanceof Date)
            && !(object instanceof Number)
            && !(object instanceof RegExp)
            && !(object instanceof String)
        );
    }
}

if (typeof PTJSON._iterate !== "function") {
    // Recursively iterate over an object or array, invoking delegate del once
    //  on each object for every proper object referenced (i.e. not String, etc).
    // If del returns an object or array, we will also iterate on that.
    //
    // Any manipulation the delegate del does to the an object will be in place.

    PTJSON._iterate = function _iterate(object, del) {
        "use strict";

        if (!object || typeof del !== "function") {
            return object;
        }
        var objects = new WeakSet();
        return (function _iter(object, oKey) {
            // only munge nestable json objects
            if (!PTJSON._isJsonObj(object)) {
                return object;
            }

            if (Array.isArray(object)) {
                object.forEach(function (element, i) {
                    _iter(element, oKey);
                });
            } else {
                if (objects.has(object)) {
                   return object;
                }
                objects.add(object);

                var dObj = del(object, oKey);
                _iter(dObj, oKey);
                Object.keys(object).forEach(function (key) {
                    _iter(object[key], oKey ? oKey+"."+key : key);
                });
            }
            return object;
        })(object);

    }
}
if (typeof PTJSON.protopack !== "function") {
    PTJSON.protopack = function protopack(object, nolibrary) {
        "use strict";

// Iterate over an object or array, in-place setting a reserved property $protoref
//  equal to the object's __proto__ if it is set to a non-null object besides Object.prototype,
//  while also recurring into the object's properties ($protoref included).
// This should allow for JSON serialization of prototype hierarchies.

// Returns a 2 object array, with the original object in the 2nd slot and a "prototypeLibrary"
//  in the 1st, containing all the root prototypes referenced in the object. This should allow
//  JSON.decycle to stringify the prototypes in one place while replacing all the protorefs in
//  the object with references.
// You can skip this behavior by invoking protopack(object, true) to directly return the
//  protopacked object without creating a prototypeLibrary.
// Be sure to invoke JSON.decycle to avoid serializing redundant prototypes over and over.

        var keyCountsByProtoRef = new Map();
        var returnObject = PTJSON._iterate(object, (function (value, valueKey) {
            if (value.__proto__ !== null && value.__proto__ !== Object.prototype) {
                value.$protoref = value.__proto__;
                value.__proto__ = Object.prototype;

                if (!nolibrary && valueKey) {
                    // normalize valueKey a bit
                    valueKey = valueKey.slice(valueKey.search("[^\.]*\.[^\.]*$"));   // NOTE - this doesn't handle keys with periods in them very well
                    // TODO consider getting fancy and smart-matching close-match keys
                    // keep track of how often the prototype's children are referred to by a certain key
                    if (!keyCountsByProtoRef.has(value.$protoref)) {
                        keyCountsByProtoRef.set(value.$protoref, {});
                    }
                    var keyCount = keyCountsByProtoRef.get(value.$protoref);
                    if (!keyCount[valueKey]) { keyCount[valueKey] = 1; }
                    else { keyCount[valueKey]++; }
                }
            }
        }));

        if (nolibrary) {
            return returnObject;
        }

        var protoLibrary = {};
        keyCountsByProtoRef.forEach(function (keyCount, protoRef) {
            // skip anything that's already referenced our library
            var grandparent = protoRef.$protoref;
            while (grandparent) {
                if (keyCountsByProtoRef.has(grandparent)) { return; }
                grandparent = grandparent.$protoref;
            }

            // normalize the key that refers to this prototype's objects most often
            var maxKeyCount = 0;
            var maxKey;
            for (var key in keyCount) {
                if (keyCount[key] > maxKeyCount) {
                    maxKeyCount = keyCount[key];
                    maxKey = key;
                }
            }
            var key = ""+maxKey;
            if (protoLibrary.hasOwnProperty(key)) {
                var keyIndex = 0;
                while (protoLibrary.hasOwnProperty(key + ++keyIndex)) { }
                key = key + keyIndex;
            }

            // set it
            protoLibrary[key] = protoRef;
        });

        return [protoLibrary, returnObject];
    }
}

if (typeof PTJSON.protounpack !== "function") {
    PTJSON.protounpack = function protounpack(object) {
        "use strict";
// discard the reference library, as it's already internally referenced
        if (Array.isArray(object) && object.length == 2) {
            object = object[1];
        }

// Iterate over an object or array, mutating it in-place by setting each object's __proto__ equal to
// the object saved in the reserved property $protoref, and deleting the $protoref property.

        return PTJSON._iterate(object, (function (value) {
            if (value.hasOwnProperty("$protoref")
                    && typeof value.$protoref === "object") {
                value.__proto__ = value.$protoref;
                delete value.$protoref;
                return value.__proto__;
            }
        }));
    }
}


if (typeof PTJSON.shallowify !== "function") {
    PTJSON.shallowify = function shallowify(object) {
        "use strict";
// Iterate over an object or array, searching for exact deep copies and replacing them with shallow ones.
// Iterates over children first, so deep copies containing deep copies should properly collapse into shallow references.
// (NOTE - discarded deep copies may still get munged)
        var objectRefs = new WeakMap();
        var refInc = 0;
        var objectsByFlat = new WeakMap();
        return (function _iterUnshallowify(object) {
            // only munge nestable json objects
            if (!PTJSON._isJsonObj(object)) {
                return object;
            }

            // store every object ref and assign it a unique number for later, flat-serialization (faking keying by composite of raw pointer values)
            if (!objectRefs.has(object)) {
                objectRefs.set(object, refInc++);
                // shallow all the children first
                if (Array.isArray(object)) {
                    object.forEach(function (element, i) {
                        object[i] = _iterUnshallowify(element);
                    });
                } else {
                    Object.keys(object).forEach(function (key) {
                        object[key] = _iterUnshallowify(object[key]);
                    });
                }
            }

            // build a flatString representation of this object as a key
            //  Nestable references are replaced with "_<num>", which eliminates redundant JSON and limits the total key size to linear wrt original obj
            // NOTE this flatString is not actually valid JSON
            // NOTE this shallows all references, not just the ones after the firct like JSON.decycle
            var flatString = JSON.stringify(object, function _flatReplacer(rValue) {
                return (objectRefs.has(rValue)) ? "_"+objectRefs.get(rValue) : rValue;
            });

            if (objectsByFlat.has(flatString)) {
                return objectsByFlat.get(flatString);
            }
            objectsByFlat.has(flatString)
            return object;
        })(object);
    }
}


if (typeof PTJSON.unshallowify !== "function") {
    PTJSON.unshallowify = function unshallowify(object) {
        "use strict";
// Iterate over an object or array, searching for shallow copies and replacing them with deep ones.
        var objects = new WeakSet();
        var stackObjects = new WeakSet();
        return (function _iterUnshallowify(object) {
            // only munge nestable json objects
            if (!PTJSON._isJsonObj(object)) {
                return object;
            }
            if (stackObjects.has(object)) {
                return object;
            }

            stackObjects.add(object);
            var nu;
            if (Array.isArray(object)) {
                nu = objects.has(object) ? [] : object;
                object.forEach(function (element, i) {
                    nu[i] = _iterUnshallowify(element);
                });
            } else {
                nu = objects.has(object) ? {} : object;
                Object.keys(object).forEach(function (key) {
                    nu[key] = _iterUnshallowify(object[key]);
                });
            }
            objects.add(nu);
            stackObjects.delete(object);
            return object;
        })(object);

    }
}

if (typeof PTJSON.prototypify !== "function") {

    PTJSON._interCount = function _interCount(set1, set2) {
        var ret = 0;
        set1.forEach(function(val) {
            if (set2.has(val)) { ret++;}
        });
        return ret;
    }

    PTJSON.prototypify = function prototypify(object, options) {
        "use strict";
// Iterate over an object or array, searching for common sets of property values that could be clustered into a common prototypes.
// In a second pass, shift these values into a new common prototype and restructure the properties within the given object to reduce redundant property declarations.
      if (!options) options = {};
      if (!options.minProtoSize) options.minProtoSize = 3;          // Prototypes should have at least 3 common attribute key-value pairs to be formed
      if (!options.minProtoUsage) options.minProtoUsage = 3;        // Prototypes should be referenced by at least 3 objects to be formed
      if (!options.maxMergeScore) options.maxMergeScore = .5;       // At least half of the objects referencing attr1 must also reference attr2 for us to put these key-value attribute pairs in the same prototype hierarchy (mergeScore is a little more complicated than that, but this is the gist)
      if (!options.maxOverrideRatio) options.maxOverrideRatio = .4; // TODO A "common" attribute may be overridden at most 40% of the time by its inheritors to be included in their prototype TODO

// First step, first pass: collect into common attributes and heuristics
        // collect JSON-able obj references
        var objectRefs = new WeakMap();
        var refInc = 0;
        PTJSON._iterate(object, (function (value) {
            if (!objectRefs.has(value)) { objectRefs.set(value, refInc++); }
            if (value.__proto__ !== null && value.__proto__ !== Object.prototype) { return value.__proto__; }
        }));
        // build attribute map on key and key-value attribute references
        var attrsByObj = new Map()
        var objsByAttr = new Map();
        var keyValsByAttr = new Map();
        PTJSON._iterate(object, (function (value) {
            if (value.__proto__ !== null && value.__proto__ !== Object.prototype) {
                // TODO impl support for pre-existing __proto__. Treat like a super attribute (which MUST match in sets).
                // TODO Lower priority overall, since objs coming in from json don't start w/ protos
                return;
            }
            var attrs = [];
            Object.entries(value).forEach(function(keyVal) {
                var attr = keyVal[0] + " : " + (objectRefs.has(keyVal[1]) ? objectRefs.get(keyVal[1]) : keyVal[1]);
                attrs.push(attr);
                if (!keyValsByAttr.has(attr)) { keyValsByAttr.set(attr, keyVal); }
            });
            attrsByObj.set(value, new Set(attrs));
            attrs.forEach(function (attr) {
                if (!objsByAttr.has(attr)) { objsByAttr.set(attr, new Set([value])); }
                else { objsByAttr.get(attr).add(value); }
            });
        }));
        // build a set of heuristic object scores to evaluate overall object connectedness
        var objScores = new WeakMap();
        attrsByObj.forEach(function (attrs, obj) {
            var score = 0;
            attrs.forEach(function(attr) {
                var attrUsage = objsByAttr.get(attr).size;
                if (attrUsage >= options.minProtoUsage) { score += attrUsage; }
            });
            objScores.set(obj, score);
        });
        // build a set of heuristic attr scores to evaluate overal attr connectedness (for candidate attrs)
        var attrScores = new Map();
        objsByAttr.forEach(function (objs, attr) {
            if (objs.size < options.minProtoUsage) { return; }
            var score = 0;
            objs.forEach(function(obj) { score += objScores.get(obj); });
            attrScores.set(attr, score);
        });
        var attrListByScore = Array.from(attrScores.keys()).sort(function(key) {return attrScores.get(key);});

// Second step, cluster common key-value attributes greedily into prototypeCandidates, starting w/ highest score
        var protoCandidates = [];
        var protoCandidatesByObj = new WeakMap();
        attrListByScore.forEach(function (attr) {
            var attrKey = keyValsByAttr.get(attr)[0];
            var attrObjs = objsByAttr.get(attr);

            // Scan the protos we've constructed thus far for target merge candidates.
            // We want the one with the lowest |AvB| - |A^B| (union vs intersection - most overlap relative to both sets)
            var protoTargets = new Set();
            attrObjs.forEach(function (obj) {
                if (protoCandidatesByObj.has(obj)) { protoTargets.add(protoCandidatesByObj.get(obj)); }
            });
            var mergeCandidate = null;
            var minMergeScore = 100;
            protoTargets.forEach(function (protoTarget) {
                var interCount = PTJSON._interCount(attrObjs, protoTarget.objs);
                var keyInterCount = 0;
                var mergeScore = (attrObjs.size - interCount)               // superProtoObjs.size - I apply to more objects than this protoTarget
                                // TODO add score considerations for override threshold ratio. Consider adding the objs with the key but not the val.
                                 + (protoTarget.objs.size - interCount)*3;  // subProtoObjs.size - I apply to fewer objects than this protoTarget
                if (mergeScore < minMergeScore) {
                    minMergeScore = mergeScore;
                    mergeCandidate = protoTarget;
                }
            });

            var protoCandidate = null;
            if (!mergeCandidate || minMergeScore/attrObjs.size > options.maxMergeScore) {
                // no candidate found - insert a single-attr candidate
                protoCandidate = {
                    objs: new Set(attrObjs),
                    attrs: new Set([attr]),
                    parentProto: null,
                    childProtos: []
                };
            } else {
                // otherwise, attempt a merge with the given candidate
                if (minMergeScore == 0) {
                    // exact objSet match is trivially simple
                    mergeCandidate.attrs.add(attr);
                    // TODO check for key overrides in the objects not covered? Check adjustedMergeScore? If they're overridden, we can include them in the parent?
                } else {
                    // Two exclusive kinds of inexact match:
                    // - superProtoObjs - You do not cover all my objects, so I'm spawning a parent if I can.
                    // - subProtoObjs - I do not apply to all your objects, so I'm spawning a child.
                    // We can't handle both - we must choose one or the other
                    if (!mergeCandidate.parentProto && attrObjs.size > mergeCandidate.objs.size) {
                        // spawn parent (with just intersection objects)
                        protoCandidate = {
                            objs: new Set(),
                            attrs: new Set([attr]),
                            parentProto: null,
                            childProtos: [mergeCandidate]
                        };
                        mergeCandidate.parentProto = protoCandidate;
                        mergeCandidate.objs.forEach(function (mcObj) {
                            // Just the intersection
                            if (attrObjs.has(mcObj)) { protoCandidate.objs.add(mcObj); }
                        });
                    } else {
                        // spawn child
                        protoCandidate = {
                            objs: new Set(attrObjs),
                            attrs: new Set([attr]),
                            parentProto: mergeCandidate,
                            childProtos: []
                        };
                        mergeCandidate.childProtos.push(protoCandidate);
                    }
                }
            }
            if (protoCandidate) {
                protoCandidates.push(protoCandidate);
                attrObjs.forEach(function (obj) {
                    if (!protoCandidatesByObj.has(obj)) { protoCandidatesByObj.set(obj, protoCandidate); }
                });
            }
        });

// Third step, collapse prototype candidates into prototypes to conform to the given options
        var protosByCandidate = new WeakMap();
        protoCandidates.forEach(function _iterMakeProto(protoCandidate) {
            if (protosByCandidate.has(protoCandidate)) {
                return protosByCandidate.get(protoCandidate);
            }
            var proto = {};
            var parent = null;
            // ensure that parents are handled/created first
            if (protoCandidate.parentProto) { parent = _iterMakeProto(protoCandidate.parentProto); }

            // If a proto doesn't have enough attributes or objects, push them down to all the proto children and skip creating this
            if (protoCandidate.attrs.size < options.minProtoSize
                    || protoCandidate.objs.size < options.minProtoUsage) {

                protoCandidate.childProtos.forEach(function (childProto) {
                    // childProto.parentProto = protoCandidate.parentProto; // NOTE - unneceessary, as we're setting protosByCandidate to skip this generation
                    // if (parent) { parent.childProtos.remove(parent.childProtos.indexOf(protoCandidate)); }  // NOTE - unnecessary, as the parent is already processed and no longer needs childProtos to be correct
                    // merge to children
                    childProto.attrs = new Set(function*() { yield* childProto.attrs; yield* protoCandidate.attrs; }());
                    // TODO if parent and child have key collisions, this merge doesn't respect them, and could break. The proto would be built an artibrary one
                    childProto.objs = new Set(function*() { yield* childProto.objs; yield* protoCandidate.objs; }());
                });

                protosByCandidate.set(protoCandidate, parent);
                return parent;
            }

            // finish building this proto
            if (parent) { proto.__proto__ = parent; }
            protoCandidate.attrs.forEach(function (attr) {
                var keyVal = keyValsByAttr.get(attr);
                proto[keyVal[0]] = keyVal[1];
            });

// Fourth step - for each object in each prototype candidate, set its proto and delete its redundant attrs (if it hasn't been set already)
            protoCandidate.objs.forEach(function (obj) {
                if (obj.__proto__ == Object.prototype) {
                    obj.__proto__ = proto;

                    Object.keys(obj).forEach(function (key) {
                        if (obj[key] === proto[key]) {
                            delete obj[key];
                        }
                    });
                }
            });
            protosByCandidate.set(protoCandidate, proto);
            return proto;
        });

        // object should be munged in place
        return object;
    }
}


if (typeof PTJSON.deprototypify !== "function") {
    PTJSON.deprototypify = function deprototypify(object) {
        "use strict";
// Iterate over an object or array, setting all inherited properties to own properties
// before setting the __proto__ to plain Object.prototype

        return PTJSON._iterate(object, (function (value) {
            var proto = value.__proto__;
            var hasProto = false;
            while (proto !== null && proto !== Object.prototype && PTJSON._isJsonObj(proto)) {
                Object.keys(proto).forEach( function (key) {
                    if (!value.hasOwnProperty(key)) {
                        value[key] = proto[key];
                    }
                });
                proto = proto.__proto__;
                hasProto = true;
            }
            if (hasProto) {
                value.__proto__ = Object.prototype;
            }
        }));
    }
}
