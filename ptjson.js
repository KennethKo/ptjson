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
    // If deepDel is given, updates each reference w/ the return value of deepDel.

    PTJSON._iterate = function _iterate(object, del, deepDel) {
        "use strict";

        if (!object || typeof del !== "function") {
            return object;
        }
        var objects = new WeakMap();
        var hasDeepDel = (typeof deepDel === "function");
        return (function _iter(object) {  // TODO does this anon _iter function get created for every invocation of _iterate?
            // only munge nestable json objects
            if (!PTJSON._isJsonObj(object)) {
                return object;
            }

            var nu = hasDeepDel ? deepDel(object) : object;
            if (Array.isArray(object)) {
                if (hasDeepDel) {
                    object.forEach(function (element, i) {
                        nu[i] = _iter(element);
                    });
                } else {
                    object.forEach(function (element, i) {
                        _iter(element);
                    });
                }
            } else {
                if (objects.get(object) !== undefined) {
                   return nu;
                }
                objects.set(object, true);

                var dObj = del(object);
                if (PTJSON._isJsonObj(dObj)) {
                    _iter(dObj); // can't deep copy back into the reference w/ this design, sadly
                }

                if (hasDeepDel) {
                    Object.keys(object).forEach(function (key) {
                        nu[name] = _iter(object[key]);
                    });
                } else {
                    Object.keys(object).forEach(function (key) {
                        _iter(object[key]);
                    });
                }
            }
            return nu;
        })(object);

    }
}
if (typeof PTJSON.protopack !== "function") {
    PTJSON.protopack = function protopack(object) {
        "use strict";

// Iterate over an object or array, in-place setting a reserved property $protoref
// equal to the object's __proto__ if it is set to an object besides Object.prototype,
// while also recurring into the object's properties ($protoref included).

// This should allow for JSON serialization of prototype hierarchies.
// Be sure to invoke JSON.decycle to avoid serializing redundant prototypes over and over.

// TODO - usage example.
        return PTJSON._iterate(object, (function _protopackDel(value) {
            if (value.__proto__ !== null && value.__proto__ !== Object.prototype) {
                value.$protoref = value.__proto__;
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

// TODO the hard part - prototypify and deprototypify


// Iterate over an object or array, searching for common sets of property values that could be collected into a common prototypes.
// Shift these values into the prototype and restructure the properties within the given object to reduce redundant property declarations.
// Save this collection of new prototypes into an object. If it's populated, this returns a 2 element array, with the new prototype collection in the first and a deep, mutated copy of the given object in the second. This should allow JSON.decycle to condense the references in the object, and not in the library.


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
