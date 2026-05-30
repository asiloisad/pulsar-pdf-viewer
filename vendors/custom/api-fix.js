// Polyfills for APIs unavailable in Chromium 124 / Electron 30
// Required by PDF.js v5.4.624+

// Promise.withResolvers (Chrome 119+)
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function () {
    var resolve;
    var reject;
    var promise = new Promise(function (res, rej) {
      resolve = res;
      reject = rej;
    });
    return { promise: promise, resolve: resolve, reject: reject };
  };
}

// RegExp.escape (Chrome 136+)
if (typeof RegExp.escape !== "function") {
  RegExp.escape = function (string) {
    return String(string).replace(/[\s\S]/g, function (char, index) {
      var code = char.charCodeAt(0);
      var hex = code.toString(16).padStart(2, "0");

      if (index === 0 && /[0-9A-Za-z]/.test(char)) {
        return "\\x" + hex;
      }
      if ("^$\\.*+?()[]{}|/".indexOf(char) !== -1) {
        return "\\" + char;
      }
      if (",-=<>#&!%:;@~'`\"".indexOf(char) !== -1) {
        return "\\x" + hex;
      }

      switch (char) {
        case "\f":
          return "\\f";
        case "\n":
          return "\\n";
        case "\r":
          return "\\r";
        case "\t":
          return "\\t";
        case "\v":
          return "\\v";
        case " ":
          return "\\x20";
      }

      return code < 0x20 || code > 0x7e
        ? "\\u" + code.toString(16).padStart(4, "0")
        : char;
    });
  };
}

// URL.parse (Chrome 126+)
if (!URL.parse) {
  URL.parse = function (url, base) {
    try {
      return new URL(url, base);
    } catch (e) {
      return null;
    }
  };
}

// Map.prototype.getOrInsertComputed (Chrome 133+)
if (!Map.prototype.getOrInsertComputed) {
  Map.prototype.getOrInsertComputed = function (key, callbackFn) {
    if (this.has(key)) {
      return this.get(key);
    }
    var value = callbackFn(key);
    this.set(key, value);
    return value;
  };
}

// Promise.try (Chrome 128+)
if (typeof Promise.try !== "function") {
  Promise.try = function (fn) {
    var a = [];
    for (var i = 1; i < arguments.length; i++) a.push(arguments[i]);
    return new Promise(function (r) {
      r(fn.apply(null, a));
    });
  };
}

// Uint8Array.prototype.toHex (Chrome 133+)
if (!Uint8Array.prototype.toHex) {
  Uint8Array.prototype.toHex = function () {
    for (var s = "", i = 0; i < this.length; i++) {
      s += (this[i] >>> 4).toString(16) + (this[i] & 0xf).toString(16);
    }
    return s;
  };
}

// Uint8Array.prototype.toBase64 (Chrome 133+)
if (!Uint8Array.prototype.toBase64) {
  Uint8Array.prototype.toBase64 = function () {
    for (var b = "", i = 0; i < this.length; i++) b += String.fromCharCode(this[i]);
    return btoa(b);
  };
}

// Uint8Array.fromBase64 (Chrome 133+)
if (!Uint8Array.fromBase64) {
  Uint8Array.fromBase64 = function (s) {
    var b = atob(s),
      a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  };
}

// Math.sumPrecise (Chrome 137+) — removed from PDF.js internal polyfill in v5.7
if (typeof Math.sumPrecise !== "function") {
  Math.sumPrecise = function (numbers) {
    return numbers.reduce(function (a, b) { return a + b; }, 0);
  };
}
