/**
 * Fetch API polyfill for mini games.
 * Uses the selected PlatformRuntime provider for network and local files.
 */

import { PlatformRuntime } from "./js/platform_runtime";

const _api = PlatformRuntime.requireCapabilities(["fileSystem"], "fetch polyfill");
const _global = PlatformRuntime.global;

class Headers {
  constructor(init = {}) {
    this._map = Object.create(null);
    if (init instanceof Headers) {
      init.forEach((value, name) => this.append(name, value));
    } else if (init && typeof init !== "string" && typeof init[Symbol.iterator] === "function") {
      for (const pair of init) {
        if (!pair || typeof pair[Symbol.iterator] !== "function") {
          throw new TypeError("Headers initializer entries must be [name, value] pairs");
        }
        const values = [...pair];
        if (values.length !== 2) {
          throw new TypeError("Headers initializer entries must contain exactly two values");
        }
        this.append(values[0], values[1]);
      }
    } else if (init && typeof init.forEach === "function") {
      init.forEach((value, name) => this.append(name, value));
    } else if (init && typeof init === "object") {
      for (const k of Object.keys(init)) this.append(k, init[k]);
    }
  }
  append(n, v) {
    const name = String(n);
    const k = name.toLowerCase();
    const current = this._map[k];
    this._map[k] = {
      name: current ? current.name : name,
      value: current ? `${current.value}, ${v}` : String(v),
    };
  }
  set(n, v) {
    const name = String(n);
    this._map[name.toLowerCase()] = { name, value: String(v) };
  }
  get(n) { return this._map[String(n).toLowerCase()]?.value ?? null; }
  has(n) { return String(n).toLowerCase() in this._map; }
  delete(n) { delete this._map[String(n).toLowerCase()]; }
  forEach(cb, thisArg = undefined) {
    for (const k in this._map) {
      const entry = this._map[k];
      cb.call(thisArg, entry.value, entry.name, this);
    }
  }
  _entriesArray() { return Object.values(this._map).map((entry) => [entry.name, entry.value]); }
  entries() { return this._entriesArray()[Symbol.iterator](); }
  keys() { return this._entriesArray().map(([name]) => name)[Symbol.iterator](); }
  values() { return this._entriesArray().map(([, value]) => value)[Symbol.iterator](); }
  [Symbol.iterator]() { return this.entries(); }
}

// Web Streams API compatible ReadableStream polyfill.
// Supports: new ReadableStream({ start(controller) { controller.enqueue(); controller.close(); } })
// And direct content: used internally by Response constructor.
class ReadableStream {
  constructor(underlyingSource) {
    this.locked = false;
    this._chunks = [];
    this._closed = false;
    this._error = null;
    this._waiting = null;

    if (underlyingSource && typeof underlyingSource.start === "function") {
      const self = this;
      const controller = {
        enqueue(chunk) {
          self._chunks.push(chunk);
          if (self._waiting) { const w = self._waiting; self._waiting = null; w(); }
        },
        close() {
          self._closed = true;
          if (self._waiting) { const w = self._waiting; self._waiting = null; w(); }
        },
        error(e) {
          self._error = e;
          self._closed = true;
          if (self._waiting) { const w = self._waiting; self._waiting = null; w(); }
        },
      };
      try { underlyingSource.start(controller); } catch (e) { this._error = e; this._closed = true; }
    } else if (underlyingSource != null) {
      this._chunks.push(underlyingSource);
      this._closed = true;
    } else {
      this._closed = true;
    }
  }

  getReader() {
    if (this.locked) throw new Error("Stream locked");
    this.locked = true;
    const self = this;
    return {
      read() {
        if (self._chunks.length > 0) {
          return Promise.resolve({ value: self._chunks.shift(), done: false });
        }
        if (self._error) {
          return Promise.reject(self._error);
        }
        if (self._closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve) => {
          self._waiting = () => {
            if (self._error) { resolve(Promise.reject(self._error)); return; }
            if (self._chunks.length > 0) { resolve({ value: self._chunks.shift(), done: false }); return; }
            resolve({ value: undefined, done: true });
          };
        });
      },
      releaseLock() { self.locked = false; },
      cancel() { self.locked = false; self._closed = true; return Promise.resolve(); },
    };
  }
}

class Response {
  constructor(body, opts = {}) {
    this._raw = body;
    this.status = opts.status ?? 200;
    this.statusText = opts.statusText || "OK";
    this.headers = opts.headers instanceof Headers ? opts.headers : new Headers(opts.headers);
    this.url = opts.url || "";
    this.ok = this.status >= 200 && this.status < 300;
    this.bodyUsed = false;

    if (body instanceof ReadableStream) {
      this.body = body;
    } else if (body != null) {
      let c;
      if (typeof body === "string") c = new TextEncoder().encode(body);
      else if (body instanceof ArrayBuffer) c = new Uint8Array(body);
      else if (ArrayBuffer.isView(body)) c = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
      else if (typeof body === "object") c = new TextEncoder().encode(JSON.stringify(body));
      else c = new Uint8Array(0);
      this.body = new ReadableStream(c);
    } else {
      this.body = null;
    }
  }

  _consume() {
    if (this.bodyUsed) return Promise.reject(new TypeError("Body consumed"));
    this.bodyUsed = true;
    if (!this.body) return Promise.resolve(new Uint8Array(0));
    const reader = this.body.getReader();
    const chunks = [];
    function pump() {
      return reader.read().then(({ value, done }) => {
        if (done) {
          reader.releaseLock();
          if (chunks.length === 0) return new Uint8Array(0);
          if (chunks.length === 1) return chunks[0];
          let total = 0;
          for (const c of chunks) total += c.byteLength;
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const c of chunks) { merged.set(c instanceof Uint8Array ? c : new Uint8Array(c), offset); offset += c.byteLength; }
          return merged;
        }
        if (value) chunks.push(value instanceof Uint8Array ? value : new Uint8Array(value.buffer || value));
        return pump();
      });
    }
    return pump();
  }

  text() { return this._consume().then(b => typeof b === "string" ? b : new TextDecoder().decode(b)); }
  json() { return this.text().then(JSON.parse); }
  arrayBuffer() {
    return this._consume().then(b => {
      if (b instanceof ArrayBuffer) return b;
      if (ArrayBuffer.isView(b)) return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      return new ArrayBuffer(0);
    });
  }
  clone() { return new Response(this._raw, { status: this.status, statusText: this.statusText, headers: this.headers, url: this.url }); }
}

function _isLocalPath(url) {
  return !(url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//"));
}

function _readLocalFile(url) {
  return new Promise((resolve, reject) => {
    const fs = _api.getFileSystemManager();
    fs.readFile({
      filePath: url,
      success(res) { resolve(res.data); },
      fail(err) { reject(new Error(err.errMsg || ("readFile failed: " + url))); },
    });
  });
}

function Fetch(url, options = {}) {
  // .wasm files are loaded directly by WXWebAssembly.instantiate (by path),
  // not through fetch. Return a stub response so Emscripten's glue code
  // proceeds to instantiateStreaming/instantiate where our shim takes over.
  if (typeof url === "string" && url.endsWith(".wasm")) {
    return Promise.resolve(new Response(new ArrayBuffer(0), { status: 200, statusText: "OK", url }));
  }

  if (_isLocalPath(url)) {
    return _readLocalFile(url).then(data => {
      return new Response(data, { status: 200, statusText: "OK", url });
    });
  }

  return new Promise((resolve, reject) => {
    PlatformRuntime.requireCapabilities(["request"], "remote fetch");
    const requestHeaders = options.headers instanceof Headers
      ? options.headers
      : new Headers(options.headers || {});
    const headers = {};
    requestHeaders.forEach((value, name) => { headers[name] = value; });
    const accept = (requestHeaders.get("accept") || "").toLowerCase();
    const requestedResponseType = String(options.responseType || "").toLowerCase();
    const responseType = requestedResponseType === "arraybuffer"
      || accept.includes("application/octet-stream")
      || accept.includes("application/wasm")
      ? "arraybuffer"
      : "text";

    _api.request({
      url,
      method: options.method || "GET",
      data: options.body || undefined,
      header: headers,
      responseType,
      dataType: (requestHeaders.get("content-type") || "").includes("json") ? "json" : undefined,
      success(res) {
        resolve(new Response(res.data, { status: res.statusCode, statusText: res.errMsg, headers: res.header, url }));
      },
      fail(err) { reject(new Error(err.errMsg || "fetch failed")); },
    });
  });
}

_global.fetch = Fetch;
_global.Headers = Headers;
_global.Response = Response;
_global.ReadableStream = ReadableStream;
