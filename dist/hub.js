/**
 * cross-storage - Cross domain local storage
 *
 * @version   1.0.0
 * @link      https://github.com/zendesk/cross-storage
 * @author    Daniel St. Jules <danielst.jules@gmail.com>
 * @copyright Zendesk
 * @license   Apache-2.0
 */

;(function(root) {
  /**
   * LocalStorageAdapter defines an interface for a web storage Adapter to be passed in
   * to CrossStorageHub when initialized. The API is the same as localStorage, but transforms
   * it to asynchronous execution.
   */
  var LocalStorageAdapter = {};

  /**
   * Retrieves the value of the given key from localStorage asynchronously. Accepts a Node-style callback
   * to call when the request is fulfilled or an error is caught. Uses setTimeout to make it asynchronous, 
   * which is supported in IE8.
   * 
   * @param {string} key Key to retrieve from localStorage
   * @param {function} callback Node-style callback to call when getItem is finished
   */
  LocalStorageAdapter.getItem = function(key, callback) {
    setTimeout(function() {
      try {
        callback(null, window.localStorage.getItem(key));
      } catch (err) {
        callback(err);
      }
    }, 0);
  };

  /**
   * Sets the key to the specified value in localStorage asynchronously. Accepts a Node-style callback
   * to call when the request is fulfilled or an error is caught. Uses setTimeout to make it asynchronous, 
   * which is supported in IE8.
   * 
   * @param {string} key Key to set in localStorage
   * @param {string} value Value to set to the key
   * @param {function} callback Node-style callback to call when finished
   */
  LocalStorageAdapter.setItem = function(key, value, callback) {
    setTimeout(function() {
      try {
        callback(null, window.localStorage.setItem(key, value));
      } catch (err) {
        callback(err);
      }
    }, 0);
  };

  /**
   * Deletes the specified key from localStorage asynchronously. Accepts a Node-style callback
   * to call when the request is fulfilled or an error is caught. Uses setTimeout to make it asynchronous, 
   * which is supported in IE8.
   * 
   * @param {string} key Key to delete in localStorage
   * @param {function} callback Node-style callback to call when finished
   */
  LocalStorageAdapter.removeItem = function(key, callback) {
    setTimeout(function() {
      try {
        callback(null, window.localStorage.removeItem(key));
      } catch (err) {
        callback(err);
      }
    }, 0);
  };

  /**
   * Gets the key at the specified index from localStorage asynchronously. Accepts a Node-style callback
   * to call when the request is fulfilled or an error is caught. Uses setTimeout to make it asynchronous, 
   * which is supported in IE8.
   * 
   * @param {string} index Index of key to retrieve from localStorage
   * @param {function} callback Node-style callback to call when finished
   */
  LocalStorageAdapter.key = function(index, callback) {
    setTimeout(function() {
      try {
        callback(null, window.localStorage.key(index));
      } catch (err) {
        callback(err);
      }
    }, 0);
  };

  /**
   * Gets number of keys from localStorage asynchronously. Accepts a Node-style callback
   * to call when the request is fulfilled or an error is caught. Uses setTimeout to make it asynchronous, 
   * which is supported in IE8.
   * 
   * @param {function} callback Node-style callback to call when finished
   */
  LocalStorageAdapter.length = function(callback) {
    setTimeout(function() {
      try {
        callback(null, window.localStorage.length);
      } catch (err) {
        callback(err);
      }
    }, 0);
  };

  /**
   * Clears all keys from localStorage asynchronously. Accepts a Node-style callback
   * to call when the request is fulfilled or an error is caught. Uses setTimeout to make it asynchronous, 
   * which is supported in IE8.
   * 
   * @param {function} callback Node-style callback to call when finished
   */
  LocalStorageAdapter.clear = function(callback) {
    setTimeout(function() {
      try {
        callback(null, window.localStorage.clear());
      } catch (err) {
        callback(err);
      }
    }, 0);
  };

  var CrossStorageHub = {};

  /**
   * Accepts an array of objects with two keys: origin and allow. The value
   * of origin is expected to be a RegExp, and allow, an array of strings.
   * The cross storage hub is then initialized to accept requests from any of
   * the matching origins, allowing access to the associated lists of methods.
   * Methods may include any of: get, set, del, getKeys and clear. A 'ready'
   * message is sent to the parent window once complete.
   * 
   * Also accepts an adapter for client-side storage that CrossStorageHub will use 
   * instead of localStorage. This adapter should follow the interface specified 
   * by LocalStorageAdapter. Methods required are similar to that of localStorage: 
   * getItem, setItem, removeItem, key, length, and clear. However, this adapter requires
   * its methods to be asynchronous and to also take in each a callback function to call
   * once the asynchronous request has finished executing.
   *
   * @example
   * // Subdomain can get, but only root domain can set and del
   * CrossStorageHub.init([
   *   {origin: /\.example.com$/,        allow: ['get']},
   *   {origin: /:(www\.)?example.com$/, allow: ['get', 'set', 'del']}
   * ]);
   * 
   *
   * @param {array} permissions An array of objects with origin and allow
   * @param {instance} StorageAdapter (optional) An adapter for client-side storage. Defaults to LocalStorageAdapter if not specified 
   */
  CrossStorageHub.init = function(permissions, StorageAdapter) {
    var available = true;

    // Return if StorageAdapter not specified and localStorage is unavailable, or third party
    // access is disabled
    try {
      if (!StorageAdapter && !window.localStorage) available = false;
    } catch (e) {
      available = false;
    }

    if (!available) {
      try {
        return window.parent.postMessage('cross-storage:unavailable', '*');
      } catch (e) {
        return;
      }
    }

    CrossStorageHub._storageAdapter = StorageAdapter || LocalStorageAdapter; // if an Adapter is not specified, defaults to LocalStorageAdapter
    CrossStorageHub._permissions = permissions || [];
    CrossStorageHub._installListener();
    window.parent.postMessage('cross-storage:ready', '*');
  };

  /**
   * Installs the necessary listener for the window message event. Accommodates
   * IE8 and up.
   *
   * @private
   */
  CrossStorageHub._installListener = function() {
    var listener = CrossStorageHub._listener;
    if (window.addEventListener) {
      window.addEventListener('message', listener, false);
    } else {
      window.attachEvent('onmessage', listener);
    }
  };

  /**
   * The message handler for all requests posted to the window. It ignores any
   * messages having an origin that does not match the originally supplied
   * pattern. Given a JSON object with one of get, set, del or getKeys as the
   * method, the function performs the requested action and returns its result.
   *
   * @param {MessageEvent} message A message to be processed
   */
  CrossStorageHub._listener = function(message) {
    var origin, request, method, error, result;

    // postMessage returns the string "null" as the origin for "file://"
    origin = (message.origin === 'null') ? 'file://' : message.origin;

    // Handle polling for a ready message
    if (message.data === 'cross-storage:poll') {
      return window.parent.postMessage('cross-storage:ready', message.origin);
    }

    // Ignore the ready message when viewing the hub directly
    if (message.data === 'cross-storage:ready') return;

    // Check whether message.data is a valid json
    try {
      request = JSON.parse(message.data);
    } catch (err) {
      return;
    }

    // Check whether request.method is a string
    if (!request || typeof request.method !== 'string') {
      return;
    }

    method = request.method.split('cross-storage:')[1];

    if (!method) {
      return;
    } else if (!CrossStorageHub._permitted(origin, method)) {
      error = 'Invalid permissions for ' + method;
      CrossStorageHub._postMessage(origin, request, error, result);
    } else {
      CrossStorageHub['_' + method](request.params, function(err, value) {
        if (err) {
          CrossStorageHub._postMessage(origin, request, err.message, result);
        } else {
          CrossStorageHub._postMessage(origin, request, error, value);
        }
      });
    }
  };

  /**
   * Posts a message back to the window.
   * 
   * @param {string} origin Origin of the request to post a message back to
   * @param {string} request Request that was made from the client
   * @param {string} error Error message to post back if exists
   * @param {string} result Result from the request to post back if exists
   */
  CrossStorageHub._postMessage = function(origin, request, error, result) {
    var response = JSON.stringify({
      id: request.id,
      error: error,
      result: result
    });

    // postMessage requires that the target origin be set to "*" for "file://"
    var targetOrigin = (origin === 'file://') ? '*' : origin;

    window.parent.postMessage(response, targetOrigin);
  }

  /**
   * Returns a boolean indicating whether or not the requested method is
   * permitted for the given origin. The argument passed to method is expected
   * to be one of 'get', 'set', 'del' or 'getKeys'.
   *
   * @param   {string} origin The origin for which to determine permissions
   * @param   {string} method Requested action
   * @returns {bool}   Whether or not the request is permitted
   */
  CrossStorageHub._permitted = function(origin, method) {
    var available, i, entry, match;

    available = ['get', 'set', 'del', 'clear', 'getKeys'];
    if (!CrossStorageHub._inArray(method, available)) {
      return false;
    }

    for (i = 0; i < CrossStorageHub._permissions.length; i++) {
      entry = CrossStorageHub._permissions[i];
      if (!(entry.origin instanceof RegExp) || !(entry.allow instanceof Array)) {
        continue;
      }

      match = entry.origin.test(origin);
      if (match && CrossStorageHub._inArray(method, entry.allow)) {
        return true;
      }
    }

    return false;
  };

  /**
   * Sets a key to the specified value. Requires a Node-style callback to call when request
   * is fulfilled or an error is caught.
   *
   * @param {object} params An object with key and value
   * @param {object} callback Node-style callback function to call when finished executing
   */
  CrossStorageHub._set = function(params, callback) {
    CrossStorageHub._storageAdapter.setItem(params.key, params.value, callback);
  };

  /**
   * Accepts an object with an array of keys for which to retrieve their values.
   * Requires a Node-style callback to call when request is fulfilled or an error is caught.
   * Passes to the callback a single value if only one key was supplied, otherwise it passes
   * an array. Any keys not set result in a null element in the resulting array.
   *
   * @param {object} params An object with an array of keys
   * @param {object} callback Node-style callback function to call when finished executing
   */
  CrossStorageHub._get = function(params, callback) {
    CrossStorageHub._all(params.keys, 'getItem', function(err, value) {
      if (err) {
        callback(err);
      } else {
        var result = (value.length > 1) ? value : value[0];
        if (!result) {
          callback(null, null);
        } else {
          callback(null, result);
        }
      }
    });
  };

  /**
   * Deletes all keys specified in the array found at params.keys.
   * Requires a Node-style callback to call when request is fulfilled or an error is caught.
   *
   * @param {object} params An object with an array of keys
   * @param {object} callback Node-style callback function to call when finished executing
   */
  CrossStorageHub._del = function(params, callback) {
    CrossStorageHub._all(params.keys, 'removeItem', function(err, value) {
      if (err) {
        callback(err);
      } else {
        callback(null);
      }
    });
  };

  /**
   * Clears localStorage. Requires a Node-style callback to call when request
   * is fulfilled or an error is caught.
   * 
   * @param {object} params An object with an array of keys. (Will be null in this case, but is needed to be consistent with other functions)
   * @param {object} callback Node-style callback function to call when finished executing
   */
  CrossStorageHub._clear = function(params, callback) {
    CrossStorageHub._storageAdapter.clear(callback);
  };

  /**
   * Requires a Node-style callback to call when request is fulfilled or an error is caught. 
   * Value passed to callback will be an array of all keys stored in localStorage.
   * 
   * @param {object} params An object with an array of keys. (Will be null in this case, but is needed to be consistent with other functions)
   * @param {object} callback Node-style callback function to call when finished executing
   */
  CrossStorageHub._getKeys = function(params, callback) {
    CrossStorageHub._storageAdapter.length(function(err, value) {
      if (err) {
        callback(err);
      } else {
        var indices = new Array(value);
        for (var i = 0; i < indices.length; i++) {
          indices[i] = i;
        }
        CrossStorageHub._all(indices, 'key', callback);
      }
    });
  };

  /**
   * Helper function to run multiple asynchronous methods. Passes back to callback the results of all asynchronous functions
   * in an array. Supports IE8.
   * 
   * @param {array} params The parameters to call CrossStorageHub._storageAdapter method with
   * @param {function} method The name of the method in CrossStorageHub._storageAdapter to call
   * @param {function} callback The Node-style callback to call when this function is done executing
   */
  CrossStorageHub._all = function(params, method, callback) {
    var results = new Array(params.length);
    var pending = params.length;
    for (var i = 0; i < params.length; i++) {
      (function(i) {
        CrossStorageHub._storageAdapter[method](params[i], function(err, value) {
          if (err) {
            callback(err);
          } else {
            results[i] = value;
            pending -=1;
            if (pending === 0) {
              callback(null, results);
            }
          }
        });
      })(i);
    }
  };

  /**
   * Returns whether or not a value is present in the array. Consists of an
   * alternative to extending the array prototype for indexOf, since it's
   * unavailable for IE8.
   *
   * @param   {*}    value The value to find
   * @param   {[]*}  array The array in which to search
   * @returns {bool} Whether or not the value was found
   */
  CrossStorageHub._inArray = function(value, array) {
    for (var i = 0; i < array.length; i++) {
      if (value === array[i]) return true;
    }

    return false;
  };

  /**
   * A cross-browser version of Date.now compatible with IE8 that avoids
   * modifying the Date object.
   *
   * @return {int} The current timestamp in milliseconds
   */
  CrossStorageHub._now = function() {
    if (typeof Date.now === 'function') {
      return Date.now();
    }

    return new Date().getTime();
  };

  /**
   * Export for various environments.
   */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CrossStorageHub;
  } else if (typeof exports !== 'undefined') {
    exports.CrossStorageHub = CrossStorageHub;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() {
      return CrossStorageHub;
    });
  } else {
    root.CrossStorageHub = CrossStorageHub;
  }
}(this));
