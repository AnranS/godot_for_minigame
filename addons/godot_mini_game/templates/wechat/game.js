import "./adapter";
import "./fetch";
import Loader from "./js/loader";

function checkUpdate() {
  try {
    const updater = wx.getUpdateManager();
    updater.onCheckForUpdate(() => {});
    updater.onUpdateReady(() => {
      wx.showModal({
        title: "更新提示",
        content: "新版本已准备好，是否重启应用？",
        success(res) { if (res.confirm) updater.applyUpdate(); },
      });
    });
    updater.onUpdateFailed(() => {});
  } catch {}
}

checkUpdate();
const loader = new Loader();
loader.load();
