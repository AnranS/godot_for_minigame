/**
 * GodotSDK — Mini-game platform bridge.
 *
 * Provides a unified API surface over wx.* / tt.* for GDScript via JavaScriptBridge.
 * Exposed as `GameGlobal.godotSdk`.
 */

const _api = (typeof wx !== "undefined") ? wx : tt;

class GodotSDK {

  // ── Engine binding ──────────────────────────────────────────────

  set_engine(engine) { this.engine = engine; }

  // ── Persistent Storage (sync) ───────────────────────────────────

  storageSet(key, value) {
    try { _api.setStorageSync(key, String(value)); }
    catch (e) { console.error("[SDK] storageSet:", e); }
  }

  storageGet(key, defaultValue) {
    try {
      const v = _api.getStorageSync(key);
      return (v !== undefined && v !== null && v !== "") ? String(v) : (defaultValue || "");
    } catch (e) { return defaultValue || ""; }
  }

  storageRemove(key) {
    try { _api.removeStorageSync(key); }
    catch (e) { console.error("[SDK] storageRemove:", e); }
  }

  storageClear() {
    try { _api.clearStorageSync(); }
    catch (e) { console.error("[SDK] storageClear:", e); }
  }

  storageGetAll() {
    try {
      const res = _api.getStorageInfoSync();
      return JSON.stringify({ keys: res.keys, size: res.currentSize, limit: res.limitSize });
    } catch (e) { return "{}"; }
  }

  // ── Auth / Login ────────────────────────────────────────────────

  login(callback) {
    _api.login({
      success: (res) => callback(res.code || "", ""),
      fail: (err) => callback("", err.errMsg || String(err)),
    });
  }

  getUserInfo(callback) {
    const handler = {
      desc: "用于完善用户资料",
      success: (res) => callback(JSON.stringify(res.userInfo || {}), ""),
      fail: (err) => callback("", err.errMsg || String(err)),
    };
    if (_api.getUserProfile) {
      _api.getUserProfile(handler);
    } else {
      _api.getUserInfo(handler);
    }
  }

  checkSession(callback) {
    _api.checkSession({
      success: () => callback(true, ""),
      fail: (err) => callback(false, err.errMsg || "session expired"),
    });
  }

  // ── Share ───────────────────────────────────────────────────────

  shareApp(title, imageUrl, query) {
    _api.shareAppMessage({ title: title || "", imageUrl: imageUrl || "", query: query || "" });
  }

  showShareMenu() {
    _api.showShareMenu({
      withShareTicket: false,
      menus: ["shareAppMessage", "shareTimeline"],
    });
  }

  hideShareMenu() {
    _api.hideShareMenu({});
  }

  onShareApp(callback) {
    _api.onShareAppMessage(() => {
      const info = callback("shareAppMessage");
      try { return typeof info === "string" ? JSON.parse(info) : (info || {}); }
      catch (_) { return {}; }
    });
  }

  // ── Rewarded Video Ad ──────────────────────────────────────────

  createRewardedAd(adId, callback) {
    try {
      if (this._rewardedAd) { try { this._rewardedAd.destroy(); } catch (_) {} }
      if (!_api.createRewardedVideoAd) { if (callback) callback(false, "createRewardedVideoAd not supported"); return; }
      this._rewardedAd = _api.createRewardedVideoAd({ adUnitId: adId });
      this._rewardedAd.onError((err) => console.warn("[SDK] RewardedAd error:", err));
      if (callback) callback(true, "");
    } catch (e) { console.warn("[SDK] createRewardedAd:", e); if (callback) callback(false, e.errMsg || String(e)); }
  }

  showRewardedAd(callback) {
    if (!this._rewardedAd) { callback(false, "No rewarded ad created. Call createRewardedAd first."); return; }
    try {
      const ad = this._rewardedAd;
      const onClose = (res) => {
        ad.offClose(onClose);
        callback(!!(res && res.isEnded), "");
      };
      ad.onClose(onClose);
      ad.show().catch(() => ad.load().then(() => ad.show()))
        .catch((err) => { ad.offClose(onClose); callback(false, err.errMsg || String(err)); });
    } catch (e) { callback(false, e.errMsg || String(e)); }
  }

  // ── Banner Ad ──────────────────────────────────────────────────

  createBannerAd(adId, callback) {
    try {
      if (this._bannerAd) { try { this._bannerAd.destroy(); } catch (_) {} }
      if (!_api.createBannerAd) { if (callback) callback(false, "createBannerAd not supported"); return; }
      const info = _api.getWindowInfo ? _api.getWindowInfo() : _api.getSystemInfoSync();
      this._bannerAd = _api.createBannerAd({
        adUnitId: adId,
        style: { left: 0, top: (info.windowHeight || info.screenHeight) - 100, width: info.windowWidth || info.screenWidth },
      });
      this._bannerAd.onError((err) => console.warn("[SDK] BannerAd error:", err));
      if (callback) callback(true, "");
    } catch (e) { console.warn("[SDK] createBannerAd:", e); if (callback) callback(false, e.errMsg || String(e)); }
  }

  showBannerAd() { try { if (this._bannerAd) this._bannerAd.show(); } catch (e) { console.warn("[SDK] showBannerAd:", e); } }
  hideBannerAd() { try { if (this._bannerAd) this._bannerAd.hide(); } catch (e) { console.warn("[SDK] hideBannerAd:", e); } }
  destroyBannerAd() { try { if (this._bannerAd) { this._bannerAd.destroy(); this._bannerAd = null; } } catch (e) { console.warn("[SDK] destroyBannerAd:", e); } }

  // ── Interstitial Ad ────────────────────────────────────────────

  createInterstitialAd(adId, callback) {
    try {
      if (this._interstitialAd) { try { this._interstitialAd.destroy(); } catch (_) {} }
      if (!_api.createInterstitialAd) { if (callback) callback(false, "createInterstitialAd not supported"); return; }
      this._interstitialAd = _api.createInterstitialAd({ adUnitId: adId });
      this._interstitialAd.onError((err) => console.warn("[SDK] InterstitialAd error:", err));
      if (callback) callback(true, "");
    } catch (e) { console.warn("[SDK] createInterstitialAd:", e); if (callback) callback(false, e.errMsg || String(e)); }
  }

  showInterstitialAd(callback) {
    if (!this._interstitialAd) { callback(false, "No interstitial ad created."); return; }
    try {
      this._interstitialAd.show()
        .then(() => callback(true, ""))
        .catch((err) => callback(false, err.errMsg || String(err)));
    } catch (e) { callback(false, e.errMsg || String(e)); }
  }

  // ── Payment ────────────────────────────────────────────────────

  requestPayment(paramsJson, callback) {
    let p;
    try { p = JSON.parse(paramsJson); } catch (_) { callback(false, "Invalid JSON params"); return; }
    _api.requestMidasPayment({
      ...p,
      success: () => callback(true, ""),
      fail: (err) => callback(false, err.errMsg || String(err)),
    });
  }

  // ── Vibration ──────────────────────────────────────────────────

  vibrateShort(type) { _api.vibrateShort({ type: type || "medium" }); }
  vibrateLong() { _api.vibrateLong({}); }

  // ── Keyboard ───────────────────────────────────────────────────

  showKeyboard(defaultValue, maxLength, multiple, callback) {
    _api.offKeyboardInput(); _api.offKeyboardConfirm(); _api.offKeyboardComplete();
    _api.onKeyboardInput((res) => callback("input", res.value));
    _api.onKeyboardConfirm((res) => callback("confirm", res.value));
    _api.onKeyboardComplete((res) => callback("complete", res.value));
    _api.showKeyboard({
      defaultValue: defaultValue || "",
      maxLength: maxLength || 140,
      multiple: !!multiple,
      confirmHold: false,
      confirmType: "done",
    });
  }

  hideKeyboard() {
    _api.hideKeyboard({});
    _api.offKeyboardInput(); _api.offKeyboardConfirm(); _api.offKeyboardComplete();
  }

  // ── Network / HTTP ─────────────────────────────────────────────

  httpRequest(url, method, data, headersJson, callback) {
    let h = {};
    try { h = headersJson ? JSON.parse(headersJson) : {}; } catch (_) {}
    _api.request({
      url,
      method: method || "GET",
      data: data || "",
      header: h,
      success: (res) => {
        const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        callback(res.statusCode, body, "");
      },
      fail: (err) => callback(0, "", err.errMsg || String(err)),
    });
  }

  // ── System Info ────────────────────────────────────────────────

  getSystemInfo() {
    try { return JSON.stringify(_api.getSystemInfoSync()); }
    catch (_) { return "{}"; }
  }

  getLaunchOptions() {
    try { return JSON.stringify(_api.getLaunchOptionsSync()); }
    catch (_) { return "{}"; }
  }

  getWindowInfo() {
    try {
      const fn = _api.getWindowInfo || _api.getSystemInfoSync;
      return JSON.stringify(fn.call(_api));
    } catch (_) { return "{}"; }
  }

  getMenuButtonRect() {
    try { return JSON.stringify(_api.getMenuButtonBoundingClientRect()); }
    catch (_) { return "{}"; }
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  onAppShow(callback) {
    _api.onShow((res) => callback(JSON.stringify(res || {})));
  }

  onAppHide(callback) {
    _api.onHide(() => callback(""));
  }

  onAppError(callback) {
    _api.onError((msg) => callback(typeof msg === "string" ? msg : JSON.stringify(msg)));
  }

  // ── Clipboard ──────────────────────────────────────────────────

  setClipboard(data) {
    _api.setClipboardData({ data: data || "" });
  }

  getClipboard(callback) {
    _api.getClipboardData({
      success: (res) => callback(res.data || "", ""),
      fail: (err) => callback("", err.errMsg || String(err)),
    });
  }

  // ── Screen ─────────────────────────────────────────────────────

  setKeepScreenOn(keepOn) {
    _api.setKeepScreenOn({ keepScreenOn: !!keepOn });
  }

  // ── Toast / Modal (platform native) ────────────────────────────

  showToast(title, icon, duration) {
    _api.showToast({ title: title || "", icon: icon || "none", duration: duration || 1500 });
  }

  showModal(title, content, callback) {
    _api.showModal({
      title: title || "",
      content: content || "",
      success: (res) => callback(!!res.confirm, !!res.cancel),
    });
  }

  showLoading(title) { _api.showLoading({ title: title || "", mask: true }); }
  hideLoading() { _api.hideLoading({}); }

  // ── File system bridge (existing) ──────────────────────────────

  writeFile(path, array) {
    const fs = _api.getFileSystemManager();
    const idx = path.lastIndexOf("/");
    const dir = idx > 0 ? path.slice(0, idx) : "/";
    return this._ensureDir(fs, `${_api.env.USER_DATA_PATH}${dir}`)
      .then(() => new Promise((resolve, reject) => {
        fs.open({ filePath: `${_api.env.USER_DATA_PATH}${path}`, flag: "w+",
          success: res => resolve(res.fd), fail: reject });
      }))
      .then(fd => new Promise((resolve, reject) => {
        fs.write({ fd, data: array.buffer || array,
          success: () => resolve(fd), fail: err => reject({ fd, error: err }) });
      }))
      .then(fd => new Promise((resolve, reject) => {
        fs.close({ fd, success: resolve, fail: reject });
      }))
      .catch(err => {
        if (err && err.fd !== undefined) {
          return new Promise((resolve, reject) => {
            fs.close({ fd: err.fd, success: resolve, fail: reject });
          }).then(() => { throw err.error; });
        }
        throw err;
      });
  }

  copyLocalToFS(path) {
    const fs = _api.getFileSystemManager();
    return this._accessOrMkdir(fs, `${_api.env.USER_DATA_PATH}${path}`)
      .then(() => new Promise((resolve, reject) => {
        fs.readdir({ dirPath: `${_api.env.USER_DATA_PATH}${path}`,
          success: res => resolve(res.files.filter(v => v !== "." && v !== "..")),
          fail: reject });
      }))
      .then(dirs => dirs.reduce((chain, name) => chain.then(() => {
        const p = `${_api.env.USER_DATA_PATH}${path}/${name}`;
        return new Promise((resolve, reject) => {
          fs.stat({ path: p, success: r => resolve(r.stats), fail: reject });
        }).then(stat => {
          if (stat.isDirectory()) return this.copyLocalToFS(`${path}/${name}`);
          if (stat.isFile()) {
            return new Promise((resolve, reject) => {
              fs.readFile({ filePath: p, success: r => { this.engine.copyToFS(`${path}/${name}`, r.data); resolve(); }, fail: reject });
            });
          }
        });
      }), Promise.resolve()));
  }

  syncfs(onSuccess, onError) {
    if (!this.engine || typeof this.engine.copyFSToAdapter !== "function") {
      if (onSuccess) onSuccess();
      return;
    }
    this.engine.copyFSToAdapter(this)
      .then(() => { if (onSuccess) onSuccess(); })
      .catch(err => { if (onError) onError(err); });
  }

  downloadSubpacks(onSuccess, onError) {
    return new Promise((resolve, reject) => {
      _api.loadSubpackage({ name: "subpacks", success: () => resolve(), fail: reject });
    }).then(() => {
      const fs = _api.getFileSystemManager();
      return new Promise((resolve, reject) => {
        fs.readdir({ dirPath: "subpacks", success: res => resolve(res.files), fail: reject });
      });
    }).then(files => {
      const fs = _api.getFileSystemManager();
      return Promise.all(files.filter(f => !f.endsWith(".js")).map(f =>
        new Promise((resolve, reject) => {
          fs.readFile({ filePath: `subpacks/${f}`, success: res => resolve({ name: f, data: res.data }), fail: reject });
        })
      ));
    }).then(values => {
      values.forEach(v => this.engine.copyToFS(`subpacks/${v.name}`, v.data));
      if (onSuccess) onSuccess();
    }).catch(reason => { if (onError) onError(reason.errMsg || reason); });
  }

  downloadCDNSubpacks(url, onSuccess, onError) {
    return new Promise((resolve, reject) => {
      _api.request({ url, responseType: "arraybuffer", method: "GET", success: res => resolve(res.data), fail: reject });
    }).then(data => {
      const filename = url.split("/").pop();
      this.engine.copyToFS(`subpacks/${filename}`, data);
      if (onSuccess) onSuccess();
    }).catch(reason => { if (onError) onError(reason); });
  }

  _ensureDir(fs, dirPath) {
    return new Promise(resolve => {
      fs.access({ path: dirPath, success: resolve,
        fail: () => { fs.mkdir({ dirPath, recursive: true, success: resolve, fail: resolve }); } });
    });
  }

  _accessOrMkdir(fs, dirPath) {
    return new Promise((resolve, reject) => {
      fs.access({ path: dirPath, success: resolve, fail: reject });
    }).catch(() => new Promise((resolve, reject) => {
      fs.mkdir({ dirPath, recursive: true, success: resolve, fail: reject });
    }));
  }
}

export { GodotSDK };
