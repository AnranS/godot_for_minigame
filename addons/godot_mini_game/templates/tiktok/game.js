import "./adapter";
import "./fetch";
import Loader from "./js/loader";
import { PlatformRuntime } from "./js/platform_runtime";

const _api = PlatformRuntime.requirePlatform("tiktok", "TikTok entrypoint");

function checkUpdate() {
  try {
    if (typeof _api.getUpdateManager !== "function") return;
    const updater = _api.getUpdateManager();
    if (!updater) return;
    if (typeof updater.onCheckForUpdate === "function") updater.onCheckForUpdate(() => {});
    if (typeof updater.onUpdateReady === "function") updater.onUpdateReady(() => {
      if (typeof _api.showModal !== "function") return;
      _api.showModal({
        title: "Update available",
        content: "A new version is ready. Restart now?",
        success(res) {
          if (res.confirm && typeof updater.applyUpdate === "function") updater.applyUpdate();
        },
      });
    });
    if (typeof updater.onUpdateFailed === "function") updater.onUpdateFailed(() => {});
  } catch {}
}

checkUpdate();
const loader = new Loader();
loader.load().catch((error) => console.error("[Game] TikTok startup failed:", error));
