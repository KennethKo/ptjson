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
                ));

      minJson = JSON.stringify(     // 5. Convert to JSON
                JSON.decycle(       // 4. Replace shallow copy references with JSONPath references
                PTJSON.protopack(   // 3. Move __proto__ references into a JSON serializable $protoref property
                PTJSON.prototypify( // 2. Find common object properties and shift them into shared (shallow copy) __proto__ objects
                PTJSON.shallowify(  // 1. Replace deep copies with shallow ones
                  o
                ))));
      unminO = PTJSON.unshallowify(
               PTJSON.deprototypify(
               PTJSON.protounpack(
               JSON.retrocycle(
               JSON.parse(
                 minJson
               ))));

      unminJson = JSON.stringify(
                  JSON.decycle(
                    unminO
                  ));
*/


if (typeof PTJSON !== "object") {
    PTJSON = {};
}

if (typeof PTJSON._isJsonObj !== "function") {
    PTJSON._isJsonObj = function _iterate(object) {
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
    // on each object for every proper object referenced (i.e. not String, etc).
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
                    _iter(element);
                });
            } else {
                if (objects.has(object)) {
                   return object;
                }
                objects.add(object);

                var dObj = del(object, oKey);
                _iter(dObj);
                Object.keys(object).forEach(function (key) {
                    _iter(object[key], key);
                });
            }
            return object;
        })(object);

    }
}
if (typeof PTJSON.protopack !== "function") {
    PTJSON.protopack = function protopack(object) {
        "use strict";

// Iterate over an object or array, in-place setting a reserved property $protoref
// equal to the object's __proto__ if it is set to a non-null object besides Object.prototype,
// while also recurring into the object's properties ($protoref included).

// This should allow for JSON serialization of prototype hierarchies.
// Be sure to invoke JSON.decycle to avoid serializing redundant prototypes over and over.

// TODO this should also be responsible for pushing __proto__ references to a head library. This should allow JSON.decycle to JSONPath replace the references in the objects, and not the library.
// TODO we want to push.... all object protorefs, but while skipping nested-only protorefs. Maybe by parent key.
// TODO unpack would also be responsible for dropping the library and array structure
        return PTJSON._iterate(object, (function _protopackDel(value, valueKey) {
            if (value.__proto__ !== null && value.__proto__ !== Object.prototype) {
                value.$protoref = value.__proto__;
                value.__proto__ = Object.prototype;

                // TODO if (valueKey != "$protoref") // skip giving grandchildren their own library references. They can sit nested within the library.
            }
        }));
    }
}

if (typeof PTJSON.protounpack !== "function") {
    PTJSON.protounpack = function protounpack(object) {
        "use strict";

// Iterate over an object or array, mutating it in-place by setting each object's __proto__ equal to
// the object saved in the reserved property $protoref, and deleting the $protoref property.

        return PTJSON._iterate(object, (function _protounpackDel(value) {
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
    PTJSON.deprototypify = function prototypify(object) {
        "use strict";
// Iterate over an object or array, searching for common sets of property values that could be collected into a common prototypes.
// In a second pass, shift these values into a new common prototype and restructure the properties within the given object to reduce redundant property declarations.

        return null;  //TODO
    }
}


if (typeof PTJSON.deprototypify !== "function") {
    PTJSON.deprototypify = function deprototypify(object) {
        "use strict";
// Iterate over an object or array, setting all inherited properties to own properties
// before setting the __proto__ to plain Object.prototype

        return PTJSON._iterate(object, (function _deprototypifyDel(value) {
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
