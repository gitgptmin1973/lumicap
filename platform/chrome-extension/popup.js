const progress = document.querySelector("#progress");
const setProgress = (message) => {
  progress.textContent = message;
};

async function syncProgress() {
  const { captureState } = await chrome.storage.session.get("captureState");
  if (!captureState) return;
  setProgress(captureState.message || "準備完了");
  progress.style.setProperty("--progress", `${captureState.progress || 0}%`);
}

async function runCapture(type) {
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });
  setProgress(type === "full-page" ? "ページを解析しています…" : "画面を取得しています…");
  try {
    const response = await chrome.runtime.sendMessage({ type: "LUMICAP_CAPTURE", mode: type });
    if (!response?.ok) throw new Error(response?.error || "キャプチャできませんでした");
    setProgress("PNGを保存しました");
    setTimeout(() => window.close(), 700);
  } catch (error) {
    setProgress(error.message);
    document.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "session" || !changes.captureState?.newValue) return;
  const state = changes.captureState.newValue;
  setProgress(state.message || "処理中…");
  progress.style.setProperty("--progress", `${state.progress || 0}%`);
});

document.querySelector("#fullPage").addEventListener("click", () => runCapture("full-page"));
document.querySelector("#viewport").addEventListener("click", () => runCapture("viewport"));
document.querySelector("#openStudio").addEventListener("click", async () => {
  await chrome.tabs.create({ url: "https://lumicap-chatgpt-app.minopro.workers.dev/studio/?source=chrome-extension" });
  window.close();
});
void syncProgress();
