/*
    ptjson.js
    2018-06-02
    Public Domain.
    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html
    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.
*/

/*jslint eval */

/*property
*/

if (typeof PTJSON !== "object") {
    PTJSON = {};
}

if (typeof PTJSON.protopack !== "function") {
    PTJSON.protopack = function protopack(object) {
        "use strict";

// Iterate over an object or array, setting a reserved property $protoref
// equal to the object's __proto__ if it is set to an object besides Object.prototype,
// while also setting the property on any object properties ($protoref included).

// This should allow for JSON serialization of prototype hierarchies. 
// Be sure to invoke JSON.decycle to avoid serializing redundant prototypes over and over.

// TODO - usage example.

        return (function derez(value) {
            // for deep objects
            if (
                typeof value === "object"
                && value !== null
                && !(value instanceof Boolean)
                && !(value instanceof Date)
                && !(value instanceof Number)
                && !(value instanceof RegExp)
                && !(value instanceof String)
            ) {
                if (Array.isArray(value)) {
                    value.forEach(function (element, i) {
                        derez(element)
                    });
                } else {
                    if (value.__proto__ !== null && value.__proto__ !== Object.prototype) {
                          value.$protoref = value.__proto__;
                    }
                    // recurse through the object's properties (including $protoref)
                    Object.keys(value).forEach(function (key) {
                        derez(value[key]);
                    });
                }
            }
            return value;
        }(object));
    }
}

if (typeof PTJSON.protounpack !== "function") {
    PTJSON.protounpack = function protounpack(object) {
        "use strict";
// Iterate over an object or array, mutating it by setting each object's __proto__ equal to
// the object saved in the reserved property $protoref, and deleting the $protoref property.

        return (function rez(value) {
            if (value && typeof value == "object") {
                if (Array.isArray(value)) {
                    value.forEach(function(element, i) {
                        rez(element);
                    });
                } else {
                    if (value.hasOwnProperty("$protoref")
                            && typeof value.$protoref === "object") {
                        value.__proto__ = value.$protoref;
                        delete value.$protoref;
                        rez(value.__proto__);
                    }
                    Object.keys(value).forEach(function (key) {
                        rez(value[key]);
                    });
                }
            }
            return value;
        }(object));
    }
}

// TODO the hard part - prototypify and deprototypify


// Iterate over an object or array, searching for common sets of property values that could be collected into a common prototypes.
// Shift these values into the prototype and restructure the properties within the given object to reduce redundant property declarations.
// Save this collection of new prototypes into an object. If it's populated, this returns a 2 element array, with the new prototype collection in the first and a deep, mutated copy of the given object in the second. This should allow JSON.decycle to condense the references in the object, and not in the library.







