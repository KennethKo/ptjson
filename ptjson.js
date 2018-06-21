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

                //if (!nolibrary) { // TODO remove condition of adding toplevel prototypes to the library
                if (!nolibrary && valueKey) {
                    // normalize valueKey a bit
                    if (valueKey) {
                        valueKey = valueKey.slice(valueKey.search("[^\.]*\.[^\.]*$"));   // NOTE - this doesn't handle keys with periods in them very well
                    } else {
                        valueKey = ".";
                    }
                    // TODO consider getting fancy and smart-matching close-match keys
                    // keep track of how often the prototype's children are referred to by a certain key
                    if (!keyCountsByProtoRef.has(value.$protoref)) {
                        keyCountsByProtoRef.set(value.$protoref, {});
                    }
                    var keyCount = keyCountsByProtoRef.get(value.$protoref);
                    if (!keyCount[valueKey]) { keyCount[valueKey] = 1; }
                    else { keyCount[valueKey]++; }
                }
                return value.$protoref;
            }
        }));

        if (nolibrary) {
            return returnObject;
        }

        var protoLibrary = {};  // TODO - the protolibrary itself is unordered, which can be a pain
        keyCountsByProtoRef.forEach(function (keyCount, protoRef) { // TODO this doesn't seem to ever pick up protos with super-protos?
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

    function _union() {
        return new Set(function*() { for (let set of arguments) { yield* set; }}());
    }

    PTJSON.prototypify = function prototypify(object, options) {
        "use strict";
// Iterate over an object or array, searching for common sets of property values that could be clustered into a common prototypes.
// In a second pass, shift these values into a new common prototype and restructure the properties within the given object to reduce redundant property declarations.
      if (!options) options = {};
      if (!options.minProtoSize) options.minProtoSize = 3;          // Prototypes should have at least 3 common attribute key-value pairs to be formed
      if (!options.minProtoUsage) options.minProtoUsage = 3;        // Prototypes should be referenced by at least 3 objects to be formed
      if (!options.maxMergeScore) options.maxMergeScore = .5;       // At least half of the objects referencing attr1 or attr2 must reference both for us to put these key-value attribute pairs in the same prototype hierarchy.
                                                                    // Objects requiring overrides count as half a mismatch against the .1 ratio tolerance.
      if (!options.maxHierarchyScore) options.maxHierarchyScore = .9;   // At least 90% of the objects referencing attr1 or attr2 must reference both for us to put these key-value attribute pairs in the same prototype object.
      if (!options.maxOverrideRatio) options.maxOverrideRatio = .2; // A "common" attribute may be overridden at most 40% of the time by its inheritors to be included in their prototype TODO
      if (!options.maxHemmorage) options.maxHemmorage = .1;         // If we merge an attr into a hierarchy, we can lose at most 10% of the objects represented by the attr and hierarchy

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

                if (!objsByAttr.has(attr)) { objsByAttr.set(attr, new Set([value])); }
                else { objsByAttr.get(attr).add(value); }

                if (!keyValsByAttr.has(attr)) { keyValsByAttr.set(attr, keyVal); }
            });
            attrsByObj.set(value, new Set(attrs));
            attrs.forEach(function (attr) {
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
        var protoCandidatesByObj = new Map();
        attrListByScore.forEach(function (attr) {
            var attrKey = keyValsByAttr.get(attr)[0];
            var attrObjs = objsByAttr.get(attr);

            // Scan the protos we've constructed thus far for target merge candidates.
            // We want the one with the lowest |AvB| - |A^B| (union vs intersection - most overlap relative to both sets)
            var protoTargets = new Set();
            attrObjs.forEach(function (obj) {
                if (protoCandidatesByObj.has(obj)) { protoTargets.add(protoCandidatesByObj.get(obj)); }
                // TODO this first-come precedence policy results in strange, non-collapsing behavior when the occasional value is different. Replace this with some kind of bloom filter or key collection?
            });
            var mergeTarget = {
                score: 100
            };
            Array.from(protoTargets).some(function (protoTarget) {
                // Evaluate each prototype by how well its protoObjs match the attribute's objs
                // intersect the two sets into five sets:
                //  PmA  - protoObjs not in attrObjs
                //  PmAK - protoObjs not in attrObjs, but with key overlap (can merge)
                //  PiA  - objs in both protoObjs and attrObjs
                //  AmPK - attrObjs not in protoObjs, but with key overlap (can merge)
                //  AmP  - attrObjs not in protoObjs
                var cmt = {
                    proto: protoTarget,
                    score: 0,
                    PmA  : new Set(),
                    PmAK : new Set(),
                    PiA  : new Set(),
                    AmPK : new Set(),
                    AmPKMismatchCount : 0,
                    AmP  : new Set()
                };
                protoTarget.objs.forEach(function(protoTargetObj) {
                    if (attrObjs.has(protoTargetObj)) { cmt.PiA.add(protoTargetObj); }
                    else if (protoTargetObj.hasOwnProperty(attrKey)) { cmt.PmAK.add(protoTargetObj); }
                    else { cmt.PmA.add(protoTargetObj); }
                });
                attrObjs.forEach(function(attrObj) {
                    if (protoTarget.objs.has(attrObj)) {
                        return;     // already added
                    }
                    var protoKeyMismatches = 0;
                    protoTarget.attrKeys.forEach(function(ptAttrKey) {
                        if (!attrObj.hasOwnProperty(ptAttrKey)) { protoKeyMismatches++; }
                    });
                    cmt.AmPKMismatchCount += protoKeyMismatches;
                    if (protoKeyMismatches) { cmt.AmPK.add(attrObj, protoKeyMismatches); }
                    else { cmt.AmP.add(attrObj); }
                });

                // evaluate the score based on the number objects not covered vs the number that are (normalized against the intersection)
                if (cmt.PiA.size < options.minProtoUsage) { return; }
                cmt.score += cmt.PmA.size + cmt.PmAK.size/2;
                cmt.score += cmt.AmP.size + cmt.AmPK.size/2;
                cmt.score /= cmt.PmA.size + cmt.PmAK.size + cmt.PiA.size + cmt.AmP.size + cmt.AmPK.size;
                // if this protoType already has an attr for the current key - it should not exact match (though it may slot in the same hierarchy)
                if (protoTarget.attrKeys.has(attrKey)) { cmt.score += options.maxHierarchyScore; }
                // if this prototype would go over the overridden properties threshold, it should not exact match (though it may slot in the same hierarchy)
                else if ((options.maxOverrideRatio*protoTarget.objs.size*protoTarget.attrs.size) <
                    (protoTarget.objAttrOverrideCount + cmt.PmAK.size + cmt.AmPKMismatchCount)) { cmt.score += options.maxHierarchyScore; }

                if (cmt.score < mergeTarget.score) {
                    mergeTarget = cmt;
                    if (cmt.score === 0) {
                        return true;    // found a perfect match
                    }
                }
            });

            var protoCandidate = null;
            if (!mergeTarget.proto || mergeTarget.score > options.maxMergeScore) {
                // no candidate found
                protoCandidate = -1;
            } else {
                // otherwise, attempt a merge with the given candidate
                if (mergeTarget.score <= options.maxHierarchyScore) {
                    // exact objSet match is trivially simple
                    mergeTarget.proto.attrs.add(attr);
                    mergeTarget.proto.attrKeys.add(keyValsByAttr.get(attr)[0]);
                    // add overrideable objects to this candidate, potentially expanding its obj footprint
                    if (mergeTarget.AmPK.size > 0) {
                        mergeTarget.AmPK.forEach(function(AmPKVal, AmPKKey) {
                            mergeTarget.proto.objs.add(AmPKKey);
                        });
                        mergeTarget.proto.objAttrOverrideCount += mergeTarget.AmPKMismatchCount;
                    }
                    if (mergeTarget.PmAK.size > 0) {
                        mergeTarget.proto.objAttrOverrideCount += mergeTarget.PmAK.size;
                    }
                } else if (Math.max(mergeTarget.AmP.size, mergeTarget.PmA.size) < options.maxHemmorage * (mergeTarget.PmA.size + mergeTarget.PmAK.size + mergeTarget.PiA.size + mergeTarget.AmPK.size + mergeTarget.AmP.size)) {
                    // Two exclusive kinds of inexact match:
                    // - superProtoObjs - You do not cover all my objects, so I'm spawning a parent if I can.
                    // - subProtoObjs - I do not apply to all your objects, so I'm spawning a child.
                    // We can't handle both - we must choose one or the other
                    if (!mergeTarget.proto.parentProto
                            && mergeTarget.AmP.size > mergeTarget.PmA.size) {
                        // spawn parent. (NOTE - if a viable parent already existed, it would probably have had a better score anyway)
                        var intersectionSet = attrObjs; // attrObjs == _union(mergeTarget.PiA, mergeTarget.AmPK, mergeTarget.AmP);
                        protoCandidate = {
                            objs: attrObjs,
                            objAttrOverrideCount: 0,    // NOTE - AmPK objects get overriden by another attr in mergeTarget.proto, not by objects. They don't count toward *either* override count.
                            attrs: new Set([attr]),
                            attrKeys: new Set([keyValsByAttr.get(attr)[0]]),
                            parentProto: null,
                            childProtos: [mergeCandidate]
                        };
                        mergeTarget.proto.parentProto = protoCandidate;
                        mergeTarget.PmA.forEach(function(iObj) {
                            mergeTarget.proto.objs.delete(iObj);    // no longer compatible with hierarchy
                            protoCandidatesByObj.delete(iObj);
                        });
                        // TODO there's no way for this new parent to scan for existing independant prototypes that perhaps should be under it. In theory, this would be fine, given our score ordering, but it makes this particular flow very suspect.
                    } else {
                        // spawn child
                        // just children w/ intersection. AmP objects are lost. PmAK objects remain in the parent
                        var intersectionSet = _union(mergeTarget.PiA, mergeTarget.AmPK);
                        protoCandidate = {
                            objs: new Set(intersectionSet),
                            objAttrOverrideCount: 0,
                            attrs: new Set([attr]),
                            attrKeys: new Set([keyValsByAttr.get(attr)[0]]),
                            parentProto: mergeCandidate,
                            childProtos: []
                        };
                        mergeTarget.proto.childProtos.push(protoCandidate);
                        intersectionSet.forEach(function(iObj) {
                            protoCandidatesByObj.delete(iObj);    // more specific child reference should be primary reference
                        });
                    }
                } else {
                    // no candidate found
                    protoCandidate = -1;
                }
            }
            if (protoCandidate === -1) {
                // no candidate found - insert an independant single-attr candidate
                protoCandidate = {
                    objs: new Set(attrObjs),
                    objAttrOverrideCount: 0,
                    attrs: new Set([attr]),
                    attrKeys: new Set([keyValsByAttr.get(attr)[0]]),
                    parentProto: null,
                    childProtos: []
                };
            }
            if (protoCandidate) {
                protoCandidates.push(protoCandidate);
                protoCandidate.objs.forEach(function (obj) {
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
                    // merge protoCandidate to its children

                    // childProto.parentProto = protoCandidate.parentProto; // NOTE - unneceessary, as we're setting protosByCandidate to skip this generation
                    // if (parent) { parent.childProtos.remove(parent.childProtos.indexOf(protoCandidate)); }  // NOTE - unnecessary, as the parent is already processed and no longer needs childProtos to be correct

                    // TODO childProto.objs lost its AmP a long time ago. Is there any way to recover it safely wrt the new parent? (esp if new parent is null?)
                    protoCandidate.attrs.forEach(function (protoAttr) {
                        // NOTE - ONLY merge attributes that do not collide with the child's keys
                        var protoKey = keyValsByAttr.get(protoAttr)[0];
                        if (childProto.attrKeys.has(protoKey)) { return; }

                        childProto.attrs.add(protoAttr);
                        childProto.attrKeys.add(protoKey);
                    });
                });

                // attrs go down to children, objs go up to parents
                protosByCandidate.set(protoCandidate, parent);
                return parent;
            }

            // finish building this proto
            if (parent) { proto.__proto__ = parent; }
            protoCandidate.attrs.forEach(function (attr) {
                var keyVal = keyValsByAttr.get(attr);
                proto[keyVal[0]] = keyVal[1];
            });
            protosByCandidate.set(protoCandidate, proto);
            return proto;
        });

// Fourth step - for each object in each prototype candidate, set its proto and delete its redundant attrs (if it hasn't been set already)
        protoCandidatesByObj.forEach(function (protoCandidate, obj) {
            var proto = protosByCandidate.get(protoCandidate);
            if (proto && obj.__proto__ == Object.prototype) {
                obj.__proto__ = proto;

                // TODO if the prototype introduces a key that this object *doesn't* have, we may need to explicitly set it to undefined.
                // TODO We would also want to capture this with a special weight in scoring.

                Object.keys(obj).forEach(function (key) {
                    if (obj[key] === proto[key]) {
                        delete obj[key];
                    }
                });
            }
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
