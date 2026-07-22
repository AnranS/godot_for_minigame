import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sdkPath = path.join(projectRoot, "addons/godot_mini_game/templates/common/js/libs/sdk.js");
const loaderPath = path.join(projectRoot, "addons/godot_mini_game/templates/common/js/loader.js");
const sdkSource = fs.readFileSync(sdkPath, "utf8");

async function loadSdkWithApi(api, platform = "wx") {
  if (platform === "tt") {
    globalThis.tt = api;
    delete globalThis.wx;
  } else {
    globalThis.wx = api;
    delete globalThis.tt;
  }
  delete globalThis.indexedDB;
  const namedSource = `${sdkSource}\n//# sourceURL=persistence-sdk-${platform}.js`;
  const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(namedSource)}#${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
}

function makeFileSystem({ statProperty = "stats", timestampUnit = "milliseconds" } = {}) {
  const base = "wxfile://usr";
  const dirs = new Map([[base, 1_700_000_000_000]]);
  const files = new Map();
  const calls = [];
  let clock = 1_700_000_000_001;
  let failNextWrite = false;

  const parent = (value) => value.slice(0, value.lastIndexOf("/"));
  const fail = (options, message) => options.fail({ errMsg: message });
  const succeed = (options, value = {}) => options.success(value);
  const ensureDir = (dirPath) => {
    if (!dirPath || dirs.has(dirPath)) return;
    ensureDir(parent(dirPath));
    dirs.set(dirPath, clock++);
  };
  const addFile = (filePath, data) => {
    ensureDir(parent(filePath));
    files.set(filePath, { data: new Uint8Array(data), mtime: clock++ });
  };
  const statResult = (stats) => ({ [statProperty]: stats });
  const platformTimestamp = (mtime) => timestampUnit === "seconds" ? Math.floor(mtime / 1000) : mtime;

  const manager = {
    access(options) {
      calls.push(["access", options.path]);
      if (dirs.has(options.path) || files.has(options.path)) succeed(options);
      else fail(options, `access:fail no such file ${options.path}`);
    },
    mkdir(options) {
      calls.push(["mkdir", options.dirPath]);
      ensureDir(options.dirPath);
      succeed(options);
    },
    readdir(options) {
      calls.push(["readdir", options.dirPath]);
      if (!dirs.has(options.dirPath)) {
        fail(options, `readdir:fail no such file ${options.dirPath}`);
        return;
      }
      const names = new Set();
      for (const value of [...dirs.keys(), ...files.keys()]) {
        if (value !== options.dirPath && parent(value) === options.dirPath) {
          names.add(value.slice(options.dirPath.length + 1));
        }
      }
      succeed(options, { files: [...names].sort() });
    },
    stat(options) {
      calls.push(["stat", options.path]);
      if (dirs.has(options.path)) {
        succeed(options, statResult({
          lastModifiedTime: platformTimestamp(dirs.get(options.path)),
          isDirectory: () => true,
          isFile: () => false,
        }));
        return;
      }
      const file = files.get(options.path);
      if (file) {
        succeed(options, statResult({
          lastModifiedTime: platformTimestamp(file.mtime),
          isDirectory: () => false,
          isFile: () => true,
        }));
        return;
      }
      fail(options, `stat:fail no such file ${options.path}`);
    },
    readFile(options) {
      calls.push(["readFile", options.filePath]);
      const file = files.get(options.filePath);
      if (!file) {
        fail(options, `readFile:fail no such file ${options.filePath}`);
        return;
      }
      const data = file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength);
      succeed(options, { data });
    },
    writeFile(options) {
      calls.push(["writeFile", options.filePath]);
      if (failNextWrite) {
        failNextWrite = false;
        fail(options, "writeFile:fail disk full");
        return;
      }
      addFile(options.filePath, new Uint8Array(options.data));
      succeed(options);
    },
    unlink(options) {
      calls.push(["unlink", options.filePath]);
      if (!files.delete(options.filePath)) {
        fail(options, `unlink:fail no such file ${options.filePath}`);
        return;
      }
      succeed(options);
    },
    rmdir(options) {
      calls.push(["rmdir", options.dirPath]);
      const prefix = `${options.dirPath}/`;
      const hasChildren = [...dirs.keys(), ...files.keys()].some((value) => value.startsWith(prefix));
      if (hasChildren) {
        fail(options, `rmdir:fail directory not empty ${options.dirPath}`);
        return;
      }
      if (!dirs.delete(options.dirPath)) {
        fail(options, `rmdir:fail no such file ${options.dirPath}`);
        return;
      }
      succeed(options);
    },
  };

  const api = {
    env: { USER_DATA_PATH: base },
    getFileSystemManager: () => manager,
  };

  return {
    api,
    base,
    calls,
    dirs,
    files,
    addDir(dirPath) { ensureDir(dirPath); },
    addFile,
    failNextWrite() { failNextWrite = true; },
  };
}

function waitRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function waitTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = (event) => reject(event.target.error);
    transaction.onabort = (event) => reject(event.target.error);
  });
}

async function openDatabase(indexedDB, name) {
  return waitRequest(indexedDB.open(name, 21));
}

async function listRemoteKeys(db) {
  const transaction = db.transaction(["FILE_DATA"], "readonly");
  const finished = waitTransaction(transaction);
  const request = transaction.objectStore("FILE_DATA").index("timestamp").openKeyCursor();
  const keys = [];
  await new Promise((resolve, reject) => {
    request.onerror = (event) => reject(event.target.error);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve();
        return;
      }
      keys.push(cursor.primaryKey);
      cursor.continue();
    };
  });
  await finished;
  return keys;
}

async function getRemoteEntry(db, key) {
  const transaction = db.transaction(["FILE_DATA"], "readonly");
  const finished = waitTransaction(transaction);
  const entry = await waitRequest(transaction.objectStore("FILE_DATA").get(key));
  await finished;
  return entry;
}

async function testEngineInitRestoreDoesNotCopyTwice() {
  const host = makeFileSystem();
  host.addDir(`${host.base}/userfs/profiles`);
  host.addDir(`${host.base}/userfs/empty`);
  host.addFile(`${host.base}/userfs/profiles/slot.save`, [1, 2, 3, 4]);

  const { GodotSDK } = await loadSdkWithApi(host.api);
  const sdk = new GodotSDK();
  const copied = [];
  sdk.set_engine({
    rtenv: {},
    copyToFS(filePath, data) {
      copied.push([filePath, [...new Uint8Array(data)]]);
    },
  });

  const prepared = await sdk.preparePersistentFS(["/userfs"]);
  assert.deepEqual(prepared.paths, ["/userfs"]);
  assert.equal(prepared.entries, 3);

  // Simulate Engine.init()'s IDBFS getRemoteSet/populate transaction before
  // asking the SDK to confirm that initialization restored the mount.
  const db = await openDatabase(globalThis.indexedDB, "/userfs");
  assert.deepEqual((await listRemoteKeys(db)).sort(), [
    "/userfs/empty",
    "/userfs/profiles",
    "/userfs/profiles/slot.save",
  ]);
  const slot = await getRemoteEntry(db, "/userfs/profiles/slot.save");
  assert.deepEqual([...slot.contents], [1, 2, 3, 4]);

  const restored = await sdk.restorePersistentPaths(["/userfs"]);
  assert.equal(restored.method, "idbfs");
  assert.equal(restored.entries, 3);
  assert.deepEqual(copied, []);
}

async function testIdbWritesAndDeletesPlatformFiles() {
  const host = makeFileSystem();
  const { GodotSDK } = await loadSdkWithApi(host.api);
  const sdk = new GodotSDK();
  sdk.set_engine({ copyToFS() {} });
  await sdk.preparePersistentFS(["/userfs"]);
  const db = await openDatabase(globalThis.indexedDB, "/userfs");

  const writeTransaction = db.transaction(["FILE_DATA"], "readwrite");
  const writeFinished = waitTransaction(writeTransaction);
  const store = writeTransaction.objectStore("FILE_DATA");
  store.put({ timestamp: new Date(3000), mode: 0o40777 }, "/userfs/new");
  store.put({
    timestamp: new Date(3001),
    mode: 0o100666,
    contents: new Uint8Array([9, 8, 7]),
  }, "/userfs/new/save.bin");
  await writeFinished;

  assert.equal(host.dirs.has(`${host.base}/userfs/new`), true);
  assert.deepEqual([...host.files.get(`${host.base}/userfs/new/save.bin`).data], [9, 8, 7]);

  let successCount = 0;
  const flushed = await sdk.syncfs(() => { successCount += 1; }, () => assert.fail("sync should succeed"));
  assert.equal(flushed, true);
  assert.equal(successCount, 1);

  const deleteTransaction = db.transaction(["FILE_DATA"], "readwrite");
  const deleteFinished = waitTransaction(deleteTransaction);
  const deleteStore = deleteTransaction.objectStore("FILE_DATA");
  deleteStore.delete("/userfs/new/save.bin");
  deleteStore.delete("/userfs/new");
  await deleteFinished;
  assert.equal(host.files.has(`${host.base}/userfs/new/save.bin`), false);
  assert.equal(host.dirs.has(`${host.base}/userfs/new`), false);
}

async function testPersistenceFailuresAreObservable() {
  const host = makeFileSystem();
  const { GodotSDK } = await loadSdkWithApi(host.api);

  const unavailableSdk = new GodotSDK();
  unavailableSdk.set_engine({});
  let unavailableError = null;
  const unavailableResult = await unavailableSdk.syncfs(
    () => assert.fail("unavailable sync must not succeed"),
    (error) => { unavailableError = error; });
  assert.equal(unavailableResult, false);
  assert.match(unavailableError.message, /Persistent sync unavailable/);
  await assert.rejects(() => unavailableSdk.syncfs(), /Persistent sync unavailable/);

  const unpopulatedSdk = new GodotSDK();
  unpopulatedSdk.set_engine({ rtenv: {}, copyToFS() {} });
  await unpopulatedSdk.preparePersistentFS(["/userfs"]);
  await assert.rejects(
    () => unpopulatedSdk.restorePersistentPaths(["/userfs"]),
    /did not populate persistent IDBFS roots/);

  const sdk = new GodotSDK();
  sdk.set_engine({ copyToFS() {} });
  await sdk.preparePersistentFS(["/userfs"]);
  const db = await openDatabase(globalThis.indexedDB, "/userfs");
  host.failNextWrite();

  const transaction = db.transaction(["FILE_DATA"], "readwrite");
  const failedTransaction = waitTransaction(transaction);
  transaction.objectStore("FILE_DATA").put({
    timestamp: new Date(4000),
    mode: 0o100666,
    contents: new Uint8Array([5]),
  }, "/userfs/fail.save");
  await assert.rejects(() => failedTransaction, /disk full/);

  let writeError = null;
  const result = await sdk.syncfs(null, (error) => { writeError = error; });
  assert.equal(result, false);
  assert.match(writeError.message, /disk full/);
}

async function testLegacyEngineWriterRemainsSupported() {
  const host = makeFileSystem();
  const { GodotSDK } = await loadSdkWithApi(host.api);
  const sdk = new GodotSDK();
  let calls = 0;
  sdk.set_engine({
    copyFSToAdapter(adapter) {
      assert.equal(adapter, sdk);
      calls += 1;
      return Promise.resolve();
    },
  });
  assert.equal(await sdk.syncfs(), true);
  assert.equal(calls, 1);
}

async function testBridgeCanRebuildAndReadBackPersistedRecords() {
  const host = makeFileSystem();
  const firstModule = await loadSdkWithApi(host.api);
  const firstSdk = new firstModule.GodotSDK();
  firstSdk.set_engine({ copyToFS() {} });
  await firstSdk.preparePersistentFS(["/userfs"]);
  const firstDb = await openDatabase(globalThis.indexedDB, "/userfs");

  const transaction = firstDb.transaction(["FILE_DATA"], "readwrite");
  const finished = waitTransaction(transaction);
  const store = transaction.objectStore("FILE_DATA");
  store.put({ timestamp: new Date(5000), mode: 0o40777 }, "/userfs/rebuilt");
  store.put({
    timestamp: new Date(5001),
    mode: 0o100666,
    contents: new Uint8Array([11, 22, 33]),
  }, "/userfs/rebuilt/slot.bin");
  await finished;
  await firstSdk.syncfs();

  const secondModule = await loadSdkWithApi(host.api);
  const secondSdk = new secondModule.GodotSDK();
  await secondSdk.preparePersistentFS(["/userfs"]);
  const secondDb = await openDatabase(globalThis.indexedDB, "/userfs");
  assert.deepEqual((await listRemoteKeys(secondDb)).sort(), [
    "/userfs/rebuilt",
    "/userfs/rebuilt/slot.bin",
  ]);
  const entry = await getRemoteEntry(secondDb, "/userfs/rebuilt/slot.bin");
  assert.equal(entry.mode & 0o170000, 0o100000);
  assert.deepEqual([...entry.contents], [11, 22, 33]);
}

async function testTtBridgeReplacesAdapterWindowIndexedDb() {
  const host = makeFileSystem({ statProperty: "stat", timestampUnit: "seconds" });
  host.addFile(`${host.base}/userfs/tt-old.save`, [7, 7]);
  const oldMtime = host.files.get(`${host.base}/userfs/tt-old.save`).mtime;
  const oldIndexedDb = { old: true };
  globalThis.GameGlobal = { __adapter: { window: { indexedDB: oldIndexedDb } } };
  const { GodotSDK } = await loadSdkWithApi(host.api, "tt");
  const sdk = new GodotSDK();
  sdk.set_engine({ copyToFS() {} });
  await sdk.preparePersistentFS(["/userfs"]);

  assert.notEqual(globalThis.indexedDB, oldIndexedDb);
  assert.equal(GameGlobal.indexedDB, globalThis.indexedDB);
  assert.equal(GameGlobal.__adapter.window.indexedDB, globalThis.indexedDB);

  const db = await openDatabase(globalThis.indexedDB, "/userfs");
  const restored = await getRemoteEntry(db, "/userfs/tt-old.save");
  assert.deepEqual([...restored.contents], [7, 7]);
  assert.equal(restored.timestamp.getTime(), Math.floor(oldMtime / 1000) * 1000);
  const transaction = db.transaction(["FILE_DATA"], "readwrite");
  const finished = waitTransaction(transaction);
  transaction.objectStore("FILE_DATA").put({
    timestamp: new Date(6000),
    mode: 0o100666,
    contents: new Uint8Array([44]),
  }, "/userfs/tt.save");
  await finished;
  assert.deepEqual([...host.files.get(`${host.base}/userfs/tt.save`).data], [44]);
  delete globalThis.GameGlobal;
}

function testLoaderRestoresBeforeStartingGame() {
  const source = fs.readFileSync(loaderPath, "utf8");
  const prepare = source.indexOf("await godotSdk.preparePersistentFS(persistentPaths)");
  const init = source.indexOf("await engine.init(executable)");
  const restore = source.indexOf("await godotSdk.restorePersistentPaths(persistentPaths)");
  const start = source.indexOf("await engine.startGame({");
  assert.ok(prepare !== -1 && init !== -1 && restore !== -1 && start !== -1);
  assert.ok(prepare < init && init < restore && restore < start);
}

await testEngineInitRestoreDoesNotCopyTwice();
await testIdbWritesAndDeletesPlatformFiles();
await testPersistenceFailuresAreObservable();
await testLegacyEngineWriterRemainsSupported();
await testBridgeCanRebuildAndReadBackPersistedRecords();
await testTtBridgeReplacesAdapterWindowIndexedDb();
testLoaderRestoresBeforeStartingGame();

delete globalThis.wx;
delete globalThis.tt;
delete globalThis.indexedDB;
delete globalThis.GameGlobal;

console.log("persistence_bridge.test.mjs: ok");
