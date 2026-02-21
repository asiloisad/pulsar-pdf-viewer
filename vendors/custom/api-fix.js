// Polyfills for APIs unavailable in Chromium 124 / Electron 30
// Required by PDF.js v5.4.624+

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
