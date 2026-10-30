import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const projectRoot = path.resolve(import.meta.dirname, "..");
const commonRoot = path.join(projectRoot, "addons/godot_mini_game/templates/common");
const exporter = fs.readFileSync(path.join(projectRoot, "addons/godot_mini_game/exporter.gd"), "utf8");
// Execute exactly the JavaScript injected by the exporter, not a handwritten
// approximation of copyFSToAdapter. Keep the GDScript string JSON-compatible.
const patchLine = exporter.split("\n").find((line) => line.includes("var _module_copy_patch := "));
const copyPatch = JSON.parse(patchLine.split(" := ")[1]);
const moduleUrl = (source) => `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}#${Math.random()}`;
const hostPath = (virtualPath) => `/host-data${virtualPath}`;
const isMissing = (target) => Object.assign(new Error(`ENOENT: ${target}`), { errno: 44 });

function put(tree, target, data) {
  const parent = path.posix.dirname(target);
  if (parent !== target && !tree.has(parent)) put(tree, parent, null);
  tree.set(target, data === null ? null : new Uint8Array(data).slice());
}

function children(tree, target) {
  if (!tree.has(target)) throw isMissing(target);
  if (tree.get(target) !== null) throw new Error(`ENOTDIR: ${target}`);
  const prefix = target === "/" ? "/" : `${target}/`;
  return [...tree.keys()].filter((key) => key.startsWith(prefix) && key !== target)
    .map((key) => key.slice(prefix.length)).filter((name) => !name.includes("/"));
}

async function fixture({ host = new Map(), platform = "wechat" } = {}) {
  for (const name of ["wx", "tt", "TTMinis", "GameGlobal", "PlatformRuntime", "__godotMiniGamePlatformRuntime"]) {
    delete globalThis[name];
  }
  if (!host.has("/host-data/userfs")) put(host, "/host-data/userfs", null);
  const virtual = new Map();
  put(virtual, "/userfs", null);
  const calls = { writes: [], unlinks: [], rmdirs: [], reads: 0, manager: 0 };
  const control = {};
  const complete = (options, action) => {
    try { options.success(action() || {}); } catch (error) { options.fail(error); }
  };
  const manager = {
    access(options) {
      complete(options, () => { if (!host.has(options.path)) throw isMissing(options.path); });
    },
    mkdir(options) {
      complete(options, () => {
        let current = "";
        for (const part of options.dirPath.split("/").filter(Boolean)) {
          current += `/${part}`;
          if (host.has(current) && host.get(current) !== null) throw new Error(`ENOTDIR: ${current}`);
          if (!host.has(current)) host.set(current, null);
        }
      });
    },
    readdir(options) { complete(options, () => ({ files: children(host, options.dirPath) })); },
    stat(options) {
      complete(options, () => {
        const target = options.path || options.filePath;
        if (!host.has(target)) throw isMissing(target);
        const directory = host.get(target) === null;
        return { stats: { isDirectory: () => directory, isFile: () => !directory } };
      });
    },
    readFile(options) {
      complete(options, () => {
        if (!host.has(options.filePath)) throw isMissing(options.filePath);
        return { data: host.get(options.filePath).slice().buffer };
      });
    },
    writeFile(options) {
      calls.writes.push(options.filePath);
      const commit = () => complete(options, () => {
        const parent = path.posix.dirname(options.filePath);
        if (!host.has(parent) || host.get(parent) !== null) throw new Error(`ENOTDIR: ${parent}`);
        if (host.has(options.filePath) && host.get(options.filePath) === null) throw new Error(`EISDIR: ${options.filePath}`);
        host.set(options.filePath, new Uint8Array(options.data).slice());
      });
      if (control.write) control.write(options, commit);
      else commit();
    },
    unlink(options) {
      calls.unlinks.push(options.filePath);
      if (control.unlink) return control.unlink(options);
      complete(options, () => {
        if (!host.has(options.filePath)) throw isMissing(options.filePath);
        if (host.get(options.filePath) === null) throw new Error(`EISDIR: ${options.filePath}`);
        host.delete(options.filePath);
      });
    },
    rmdir(options) {
      calls.rmdirs.push(options.dirPath);
      assert.equal(options.recursive, false, "never recursively delete untracked host files");
      complete(options, () => {
        if (children(host, options.dirPath).length) throw new Error(`ENOTEMPTY: ${options.dirPath}`);
        host.delete(options.dirPath);
      });
    },
  };
  const api = { env: { USER_DATA_PATH: "/host-data" }, getFileSystemManager() { calls.manager++; return manager; } };
  if (platform === "tiktok") globalThis.TTMinis = { game: api };
  else if (platform === "douyin") globalThis.tt = api;
  else globalThis.wx = api;
  const runtimeUrl = moduleUrl(fs.readFileSync(path.join(commonRoot, "js/platform_runtime.js"), "utf8"));
  const sdkSource = fs.readFileSync(path.join(commonRoot, "js/libs/sdk.js"), "utf8")
    .replace('"../platform_runtime"', JSON.stringify(runtimeUrl));
  const { GodotSDK } = await import(moduleUrl(sdkSource));
  const sdk = new GodotSDK();
  const Module = {};
  vm.runInNewContext(copyPatch, {
    Module,
    GodotFS: { ENOENT: 44, _mount_points: ["/userfs"] },
    FS: {
      readdir(target) { return [".", "..", ...children(virtual, target)]; },
      stat(target) { return { mode: virtual.get(target) === null ? "dir" : "file" }; },
      isDir: (mode) => mode === "dir",
      isFile: (mode) => mode === "file",
      readFile(target) { calls.reads++; return virtual.get(target).slice(); },
    },
  });
  sdk.set_engine({
    ensureFSDirectory(target) { put(virtual, target, null); },
    copyToFS(target, bytes) { put(virtual, target, bytes); },
    copyFSToAdapter: (adapter, roots) => Module.copyFSToAdapter(adapter, roots),
  });
  return { sdk, host, virtual, calls, control };
}

async function testDigestMatchesSha256() {
  const { sdk } = await fixture();
  // Includes sizes around the 64 KiB hashing chunk and its padded tail.
  for (const size of [
    0, 1, 55, 56, 63, 64, 65, 127, 128, 129, 4096,
    65535, 65536, 65537, 65536 + 55, 65536 + 56, 131072 + 63, 1024 * 1024,
  ]) {
    const storage = new Uint8Array(size + 11);
    for (let i = 0; i < storage.length; i++) storage[i] = (i * 73 + (i >>> 8)) & 255;
    const bytes = storage.subarray(7, 7 + size);
    assert.equal(await sdk._persistentDigest(bytes), createHash("sha256").update(bytes).digest("hex"), `SHA-256 size ${size} with offset`);
  }
}

async function testUnchangedEditsDeletesAndRestart() {
  const f = await fixture();
  put(f.host, hostPath("/userfs/saves/slot.save"), [1, 2, 3]);
  put(f.host, hostPath("/userfs/empty"), null);
  await f.sdk.restorePersistentPaths();
  await f.sdk.syncfs();
  await f.sdk.syncfs();
  assert.equal(f.calls.writes.length, 0, "restore establishes a baseline, unchanged saves need no writes");
  put(f.virtual, "/userfs/saves/slot.save", [1, 9, 3]);
  await f.sdk.syncfs();
  assert.deepEqual([...f.host.get(hostPath("/userfs/saves/slot.save"))], [1, 9, 3], "same-size content edits must persist");
  await f.sdk.syncfs();
  assert.equal(f.calls.writes.length, 1);
  put(f.host, hostPath("/userfs/foreign.bin"), [77]);
  put(f.host, "/host-data/other-sdk/cache.bin", [88]);
  f.virtual.delete("/userfs/saves/slot.save");
  f.virtual.delete("/userfs/saves");
  f.virtual.delete("/userfs/empty");
  await f.sdk.syncfs();
  assert.equal(f.host.has(hostPath("/userfs/saves/slot.save")), false);
  assert.equal(f.host.has(hostPath("/userfs/saves")), false);
  assert.equal(f.host.has(hostPath("/userfs/empty")), false);
  assert.deepEqual([...f.host.get(hostPath("/userfs/foreign.bin"))], [77]);
  assert.deepEqual([...f.host.get("/host-data/other-sdk/cache.bin")], [88]);
  const restarted = await fixture({ host: f.host });
  await restarted.sdk.restorePersistentPaths();
  assert.equal(restarted.virtual.has("/userfs/saves/slot.save"), false, "deleted files must not resurrect");
  assert.equal(restarted.virtual.has("/userfs/saves"), false, "deleted empty directories must not resurrect");
}

async function testPartialWriteRetryAndRollback() {
  const f = await fixture();
  put(f.host, hostPath("/userfs/slot.save"), [1, 2]);
  await f.sdk.restorePersistentPaths();
  put(f.virtual, "/userfs/slot.save", [3, 4]);
  f.control.write = (options) => {
    f.host.set(options.filePath, new Uint8Array([3]));
    options.fail(new Error("disk full after partial write"));
  };
  await assert.rejects(f.sdk.syncfs(), /disk full/);
  put(f.virtual, "/userfs/slot.save", [1, 2]);
  delete f.control.write;
  await f.sdk.syncfs();
  assert.deepEqual([...f.host.get(hostPath("/userfs/slot.save"))], [1, 2], "rollback to the old digest still retries a partial write");
  assert.equal(f.calls.writes.length, 2);
  put(f.virtual, "/userfs/new.save", [5]);
  f.control.write = (options) => {
    f.host.set(options.filePath, new Uint8Array([5]));
    options.fail(new Error("partial new file"));
  };
  await assert.rejects(f.sdk.syncfs(), /partial new file/);
  f.virtual.delete("/userfs/new.save");
  delete f.control.write;
  await f.sdk.syncfs();
  assert.equal(f.host.has(hostPath("/userfs/new.save")), false, "an unsuccessfully written new file is also managed for cleanup");
}

async function testCompletedWritesAndFailedDeletesKeepTheirState() {
  const f = await fixture();
  await f.sdk.restorePersistentPaths();
  put(f.virtual, "/userfs/a.save", [1]);
  put(f.virtual, "/userfs/b.save", [2]);
  f.control.write = (options, commit) => options.filePath.endsWith("b.save")
    ? options.fail(new Error("retry b")) : commit();
  await assert.rejects(f.sdk.syncfs(), /retry b/);
  delete f.control.write;
  await f.sdk.syncfs();
  assert.equal(f.calls.writes.filter((p) => p.endsWith("a.save")).length, 1, "successful files in a partial batch stay synchronized");
  assert.equal(f.calls.writes.filter((p) => p.endsWith("b.save")).length, 2);
  f.virtual.delete("/userfs/a.save");
  f.control.unlink = (options) => options.fail(new Error("delete denied"));
  await assert.rejects(f.sdk.syncfs(), /delete denied/);
  assert.equal(f.host.has(hostPath("/userfs/a.save")), true);
  delete f.control.unlink;
  await f.sdk.syncfs();
  assert.equal(f.host.has(hostPath("/userfs/a.save")), false, "failed deletes remain pending for retry");
  f.virtual.delete("/userfs/b.save");
  f.host.delete(hostPath("/userfs/b.save"));
  await f.sdk.syncfs();
  assert.equal(f.sdk._persistentManifest.has("/userfs/b.save"), false, "an already removed host file completes idempotently");
}

async function testConcurrentSyncSeesChangesAfterInflightSnapshot() {
  const f = await fixture();
  await f.sdk.restorePersistentPaths();
  put(f.virtual, "/userfs/slot.save", [1, 2]);
  let release;
  f.control.write = (_options, commit) => { release = commit; };
  const first = f.sdk.syncfs();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  put(f.virtual, "/userfs/slot.save", [3, 4]);
  const second = f.sdk.syncfs();
  await Promise.resolve();
  assert.equal(f.calls.writes.length, 1, "host writes never overlap");
  delete f.control.write;
  release();
  await Promise.all([first, second]);
  assert.deepEqual([...f.host.get(hostPath("/userfs/slot.save"))], [3, 4], "queued sync snapshots the latest game state");
  assert.equal(f.calls.writes.length, 2);
  await f.sdk.syncfs();
  assert.equal(f.calls.writes.length, 2);

  release = null;
  put(f.virtual, "/userfs/slot.save", [5, 6]);
  f.control.write = (_options, commit) => { release = commit; };
  const writing = f.sdk.syncfs();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  f.virtual.delete("/userfs/slot.save");
  const deleting = f.sdk.syncfs();
  delete f.control.write;
  release();
  await Promise.all([writing, deleting]);
  assert.equal(f.host.has(hostPath("/userfs/slot.save")), false);
}

async function testRenameWriteFailurePreservesOldSave() {
  const f = await fixture();
  put(f.host, hostPath("/userfs/old.save"), [1, 2]);
  await f.sdk.restorePersistentPaths();
  f.virtual.delete("/userfs/old.save");
  put(f.virtual, "/userfs/new.save", [1, 2]);
  f.control.write = (options) => {
    f.host.set(options.filePath, new Uint8Array([1]));
    options.fail(new Error("quota exhausted"));
  };
  await assert.rejects(f.sdk.syncfs(), /quota exhausted/);
  assert.deepEqual([...f.host.get(hostPath("/userfs/old.save"))], [1, 2], "failed rename must retain the last complete save");
  assert.equal(f.calls.unlinks.length, 0);
  delete f.control.write;
  await f.sdk.syncfs();
  assert.equal(f.host.has(hostPath("/userfs/old.save")), false);
  assert.deepEqual([...f.host.get(hostPath("/userfs/new.save"))], [1, 2]);
}

async function testTypeConflictsFailBeforeHostMutations() {
  for (const initialDirectory of [false, true]) {
    const f = await fixture();
    if (initialDirectory) put(f.host, hostPath("/userfs/slot/child.save"), [2]);
    else put(f.host, hostPath("/userfs/slot"), [1]);
    await f.sdk.restorePersistentPaths();
    put(f.virtual, "/userfs/unrelated-new.save", [3]);
    if (initialDirectory) {
      f.virtual.delete("/userfs/slot/child.save");
      put(f.virtual, "/userfs/slot", [4]);
    } else {
      put(f.virtual, "/userfs/slot", null);
      put(f.virtual, "/userfs/slot/child.save", [4]);
    }
    await assert.rejects(f.sdk.syncfs(), /conflicts with a host (directory|file)/);
    assert.equal(f.calls.writes.length, 0);
    assert.equal(f.calls.unlinks.length, 0);
    assert.equal(f.calls.rmdirs.length, 0);
    const preservedPath = initialDirectory ? "/userfs/slot/child.save" : "/userfs/slot";
    assert.deepEqual([...f.host.get(hostPath(preservedPath))], initialDirectory ? [2] : [1]);
  }
  const f = await fixture();
  put(f.host, hostPath("/userfs/old-dir"), null);
  await f.sdk.restorePersistentPaths();
  put(f.host, hostPath("/userfs/old-dir/foreign.bin"), [7]);
  f.virtual.delete("/userfs/old-dir");
  await f.sdk.syncfs();
  assert.deepEqual([...f.host.get(hostPath("/userfs/old-dir/foreign.bin"))], [7], "nonempty directories with untracked files are never removed recursively");
}

async function testHashYieldsAndQueuedSyncCapturesMidHashChanges() {
  const f = await fixture();
  const bytes = new Uint8Array(256 * 1024).fill(1);
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 0);
  try {
    await f.sdk._persistentDigest(bytes);
    assert.ok(ticks >= 2, "real timers must run between hash chunks");
  } finally {
    clearInterval(timer);
  }
  await f.sdk.restorePersistentPaths();
  put(f.virtual, "/userfs/large.save", bytes);
  const first = f.sdk.syncfs();
  let queued;
  await new Promise((resolve) => setTimeout(() => {
    const updated = bytes.slice();
    updated[updated.length - 1] = 9;
    put(f.virtual, "/userfs/large.save", updated);
    queued = f.sdk.syncfs();
    resolve();
  }, 0));
  await first;
  await queued;
  assert.equal(f.calls.writes.length, 2, "a queued sync rereads content modified during hashing");
  assert.equal(f.host.get(hostPath("/userfs/large.save")).at(-1), 9);
}

async function testTikTokWriteBoundary() {
  const f = await fixture({ platform: "tiktok" });
  put(f.host, hostPath("/userfs/slot.save"), [1]);
  await f.sdk.restorePersistentPaths();
  const reads = f.calls.manager;
  await assert.rejects(f.sdk.syncfs(), /not supported on TikTok Native/);
  await assert.rejects(f.sdk.syncPersistentFiles(["/userfs"], () => {}), /not supported on TikTok Native/);
  assert.equal(f.calls.manager, reads, "write entry points fail before touching the native filesystem");
  assert.equal(f.calls.writes.length, 0);
  assert.equal(f.calls.unlinks.length, 0);
}

await testDigestMatchesSha256();
await testUnchangedEditsDeletesAndRestart();
await testPartialWriteRetryAndRollback();
await testCompletedWritesAndFailedDeletesKeepTheirState();
await testConcurrentSyncSeesChangesAfterInflightSnapshot();
await testRenameWriteFailurePreservesOldSave();
await testTypeConflictsFailBeforeHostMutations();
await testHashYieldsAndQueuedSyncCapturesMidHashChanges();
await testTikTokWriteBoundary();
console.log("persistence_sync.test.mjs: ok");
