const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const CAPTURE_STATE_KEY = "captureState";

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.windowId) throw new Error("現在のタブを確認できません");
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch {
    throw new Error("このページはブラウザの安全制限により取得できません");
  }
}

async function updateState(patch) {
  const stored = await chrome.storage.session.get(CAPTURE_STATE_KEY);
  await chrome.storage.session.set({
    [CAPTURE_STATE_KEY]: {
      ...(stored[CAPTURE_STATE_KEY] || {}),
      ...patch,
      updatedAt: new Date().toISOString()
    }
  });
}

async function savePng(dataUrl, mode) {
  const id = await chrome.downloads.download({
    url: dataUrl,
    filename: `LUMICAP/${mode}-${timestamp()}.png`,
    saveAs: false
  });
  await chrome.storage.local.set({
    lastCapture: { id, mode, createdAt: new Date().toISOString() }
  });
  return id;
}

async function captureViewport() {
  const tab = await activeTab();
  await updateState({ phase: "capturing", progress: 35, message: "表示領域を取得しています…" });
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  await updateState({ phase: "saving", progress: 85, message: "PNGを保存しています…" });
  await savePng(dataUrl, "viewport");
  return { ok: true };
}

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["BLOBS"],
    justification: "利用者が指定したページ画像を端末内で1枚のPNGへ結合するため"
  });
}

async function captureFullPage() {
  const tab = await activeTab();
  await ensureContentScript(tab.id);
  const metrics = await chrome.tabs.sendMessage(tab.id, { type: "LUMICAP_PREPARE" });
  if (!metrics?.ok) throw new Error("ページサイズを取得できません");

  const positions = [];
  const step = Math.max(1, metrics.viewportHeight);
  for (let y = 0; y < metrics.totalHeight; y += step) positions.push(y);
  const lastPosition = Math.max(0, metrics.totalHeight - metrics.viewportHeight);
  if (positions.at(-1) !== lastPosition) positions.push(lastPosition);

  const uniquePositions = [...new Set(positions)].sort((a, b) => a - b);
  if (uniquePositions.length > 120) {
    await chrome.tabs.sendMessage(tab.id, { type: "LUMICAP_RESTORE" });
    throw new Error("ページが長すぎます。120画面以内で実行してください");
  }

  const captures = [];
  try {
    for (let index = 0; index < uniquePositions.length; index += 1) {
      await updateState({
        phase: "capturing",
        progress: Math.round(10 + ((index + 1) / uniquePositions.length) * 65),
        message: `${index + 1} / ${uniquePositions.length} 画面を取得中…`
      });
      const y = uniquePositions[index];
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "LUMICAP_SCROLL",
        y,
        index
      });
      await wait(180);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      captures.push({ dataUrl, actualY: result.actualY });
    }
  } finally {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "LUMICAP_RESTORE" });
    } catch {
      // The page may have navigated while capturing; there is nothing left to restore.
    }
  }

  await updateState({ phase: "stitching", progress: 80, message: "1枚の画像へ結合しています…" });
  await ensureOffscreenDocument();
  const stitched = await chrome.runtime.sendMessage({
    type: "LUMICAP_STITCH",
    payload: {
      captures,
      totalHeight: metrics.totalHeight,
      viewportHeight: metrics.viewportHeight
    }
  });
  if (!stitched?.ok) throw new Error(stitched?.error || "画像を結合できません");
  await updateState({ phase: "saving", progress: 94, message: "PNGを保存しています…" });
  await savePng(stitched.dataUrl, "full-page");
  return { ok: true };
}

async function executeCapture(mode) {
  const stored = await chrome.storage.session.get(CAPTURE_STATE_KEY);
  if (stored[CAPTURE_STATE_KEY]?.running) {
    throw new Error("別のキャプチャを実行中です");
  }
  await chrome.storage.session.set({
    [CAPTURE_STATE_KEY]: {
      running: true,
      mode,
      phase: "starting",
      progress: 3,
      message: "準備しています…",
      updatedAt: new Date().toISOString()
    }
  });
  try {
    const result = mode === "full-page" ? await captureFullPage() : await captureViewport();
    await updateState({ running: false, phase: "complete", progress: 100, message: "PNGを保存しました" });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "キャプチャできませんでした";
    await updateState({ running: false, phase: "error", progress: 0, message });
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "LUMICAP_CAPTURE") return;
  void (async () => {
    try {
      sendResponse(await executeCapture(message.mode));
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "キャプチャできませんでした"
      });
    }
  })();
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    try {
      if (command === "capture-full-page") await executeCapture("full-page");
      if (command === "capture-viewport") await executeCapture("viewport");
    } catch {
      // The current status is persisted and shown when the popup is opened.
    }
  })();
});
