(() => {
  "use strict";

  const canvas = document.querySelector("#editorCanvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const emptyState = document.querySelector("#emptyState");
  const fileInput = document.querySelector("#fileInput");
  const dropZone = document.querySelector("#dropZone");
  const thumbs = document.querySelector("#thumbs");
  const currentFile = document.querySelector("#currentFile");
  const canvasMeta = document.querySelector("#canvasMeta");
  const toastEl = document.querySelector("#toast");
  const recordingPill = document.querySelector("#recordingPill");
  const recordTimer = document.querySelector("#recordTimer");
  const installDialog = document.querySelector("#installDialog");
  const aiDialog = document.querySelector("#aiDialog");
  const shortcutDialog = document.querySelector("#shortcutDialog");
  const detectedPlatform = document.querySelector("#detectedPlatform");
  const installNote = document.querySelector("#installNote");

  let activeTool = "select";
  let drawing = false;
  let start = null;
  let beforeDraw = null;
  let undoStack = [];
  let captures = [];
  let recorder = null;
  let recordStream = null;
  let recordChunks = [];
  let recordStartedAt = 0;
  let recordInterval = null;
  let deferredInstallPrompt = null;

  const pad = (n) => String(n).padStart(2, "0");
  const stamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };
  const toast = (message) => {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  };
  const setSaved = (message = "ローカル保存") => {
    document.querySelector("#saveState").textContent = message;
  };

  function selectTool(tool) {
    const button = document.querySelector(`[data-tool="${tool}"]`);
    if (!button) return;
    document.querySelectorAll("[data-tool]").forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
    activeTool = tool;
    canvas.style.cursor = activeTool === "select" ? "default" : "crosshair";
    toast(`${button.getAttribute("aria-label")}ツール`);
  }

  function toggleRecording() {
    if (recorder?.state === "recording") stopRecording();
    else startRecording();
  }

  function openShortcutDialog() {
    if (!shortcutDialog.open) shortcutDialog.showModal();
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function saveUndo() {
    try {
      undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (undoStack.length > 16) undoStack.shift();
    } catch (_) {}
  }

  function undo() {
    const image = undoStack.pop();
    if (!image) return toast("これ以上戻せません");
    ctx.putImageData(image, 0, 0);
    setSaved("変更あり");
  }

  function drawArrow(x1, y1, x2, y2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = Math.max(16, canvas.width * .025);
    ctx.strokeStyle = "#ff5e47";
    ctx.fillStyle = "#ff5e47";
    ctx.lineWidth = Math.max(4, canvas.width * .006);
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath(); ctx.fill();
  }

  function pixelate(x, y, w, h) {
    const sx = Math.round(Math.min(x, x + w));
    const sy = Math.round(Math.min(y, y + h));
    const sw = Math.max(1, Math.round(Math.abs(w)));
    const sh = Math.max(1, Math.round(Math.abs(h)));
    if (!sw || !sh) return;
    const scale = Math.max(4, Math.floor(Math.min(sw, sh) / 14));
    const temp = document.createElement("canvas");
    temp.width = Math.max(1, Math.ceil(sw / scale));
    temp.height = Math.max(1, Math.ceil(sh / scale));
    const t = temp.getContext("2d");
    t.imageSmoothingEnabled = false;
    t.drawImage(canvas, sx, sy, sw, sh, 0, 0, temp.width, temp.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(temp, 0, 0, temp.width, temp.height, sx, sy, sw, sh);
    ctx.imageSmoothingEnabled = true;
  }

  function pointerDown(event) {
    if (emptyState && !emptyState.classList.contains("hidden")) return;
    if (activeTool === "select") return;
    event.preventDefault();
    drawing = true;
    start = pointFromEvent(event);
    saveUndo();
    beforeDraw = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (activeTool === "text") {
      const text = window.prompt("追加するテキストを入力してください", "ここを確認");
      if (text) {
        ctx.font = `700 ${Math.max(20, canvas.width * .035)}px "Yu Gothic UI", sans-serif`;
        ctx.textBaseline = "top";
        const width = ctx.measureText(text).width + 28;
        ctx.fillStyle = "#c9ff52";
        ctx.fillRect(start.x - 10, start.y - 8, width, Math.max(42, canvas.width * .055));
        ctx.fillStyle = "#101923";
        ctx.fillText(text, start.x + 4, start.y);
      }
      drawing = false;
      setSaved("変更あり");
    }
  }

  function pointerMove(event) {
    if (!drawing || !start) return;
    event.preventDefault();
    const p = pointFromEvent(event);
    if (activeTool !== "pen") ctx.putImageData(beforeDraw, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (activeTool === "pen") {
      ctx.strokeStyle = "#ff5e47";
      ctx.lineWidth = Math.max(3, canvas.width * .005);
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      start = p;
    } else if (activeTool === "arrow") {
      drawArrow(start.x, start.y, p.x, p.y);
    } else if (activeTool === "rect") {
      ctx.strokeStyle = "#ff5e47"; ctx.lineWidth = Math.max(4, canvas.width * .006);
      ctx.strokeRect(start.x, start.y, p.x - start.x, p.y - start.y);
    } else if (activeTool === "highlight") {
      ctx.fillStyle = "rgba(201,255,82,.46)";
      ctx.fillRect(start.x, start.y, p.x - start.x, p.y - start.y);
    } else if (activeTool === "blur") {
      ctx.strokeStyle = "#c9ff52"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.strokeRect(start.x, start.y, p.x - start.x, p.y - start.y); ctx.setLineDash([]);
    }
  }

  function pointerUp(event) {
    if (!drawing || !start) return;
    const p = pointFromEvent(event);
    if (activeTool === "blur") {
      ctx.putImageData(beforeDraw, 0, 0);
      pixelate(start.x, start.y, p.x - start.x, p.y - start.y);
    }
    drawing = false; start = null; beforeDraw = null;
    setSaved("変更あり");
  }

  async function loadImageSource(source, name = `capture-${stamp()}.png`, addHistory = true) {
    const img = new Image();
    img.onload = () => {
      const max = 1920;
      const scale = Math.min(1, max / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      emptyState.classList.add("hidden");
      currentFile.textContent = name;
      canvasMeta.textContent = `${canvas.width} × ${canvas.height} px`;
      undoStack = [];
      setSaved("ローカル保存");
      if (addHistory) addCapture(source, name);
    };
    img.onerror = () => toast("画像を読み込めませんでした");
    img.src = source;
  }

  function addCapture(url, name) {
    const item = { id: crypto.randomUUID?.() || String(Date.now()), url, name };
    captures.push(item);
    if (captures.length > 12) captures.shift();
    renderThumbs(item.id);
  }

  function renderThumbs(activeId) {
    thumbs.querySelectorAll(".capture-thumb").forEach((node) => node.remove());
    thumbs.querySelector(".starter")?.classList.remove("active");
    const add = thumbs.querySelector(".add-thumb");
    captures.forEach((item) => {
      const button = document.createElement("button");
      button.className = `thumb capture-thumb${item.id === activeId ? " active" : ""}`;
      button.innerHTML = `<img alt="" src="${item.url}"><small>${item.name.replace(/\.[^.]+$/, "")}</small>`;
      button.addEventListener("click", () => {
        document.querySelectorAll(".thumb").forEach((el) => el.classList.remove("active"));
        button.classList.add("active");
        loadImageSource(item.url, item.name, false);
      });
      thumbs.insertBefore(button, add);
    });
  }

  async function captureScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast("画面取得にはlocalhostまたはHTTPSが必要です");
      return fileInput.click();
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 220));
      const temp = document.createElement("canvas");
      temp.width = video.videoWidth;
      temp.height = video.videoHeight;
      temp.getContext("2d").drawImage(video, 0, 0);
      stream.getTracks().forEach((track) => track.stop());
      const url = temp.toDataURL("image/png");
      await loadImageSource(url, `capture-${stamp()}.png`);
      document.querySelector("#studio").scrollIntoView({ behavior: "smooth", block: "center" });
      toast("キャプチャしました。すぐに編集できます");
    } catch (error) {
      if (error?.name !== "NotAllowedError") toast("画面を取得できませんでした");
    }
  }

  async function startRecording() {
    if (recorder?.state === "recording") return stopRecording();
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      return toast("このブラウザは画面録画に対応していません");
    }
    try {
      recordStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      recordChunks = [];
      recorder = new MediaRecorder(recordStream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
      recorder.addEventListener("dataavailable", (e) => e.data.size && recordChunks.push(e.data));
      recorder.addEventListener("stop", saveRecording);
      recordStream.getVideoTracks()[0]?.addEventListener("ended", () => recorder?.state === "recording" && recorder.stop());
      recorder.start(1000);
      recordStartedAt = Date.now();
      recordingPill.hidden = false;
      recordInterval = setInterval(updateRecordTimer, 250);
      updateRecordTimer();
      toast("録画を開始しました");
    } catch (error) {
      if (error?.name !== "NotAllowedError") toast("録画を開始できませんでした");
    }
  }

  function updateRecordTimer() {
    const seconds = Math.floor((Date.now() - recordStartedAt) / 1000);
    recordTimer.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  }

  function stopRecording() {
    if (recorder?.state === "recording") recorder.stop();
    recordStream?.getTracks().forEach((track) => track.stop());
    clearInterval(recordInterval);
    recordingPill.hidden = true;
  }

  function saveRecording() {
    const blob = new Blob(recordChunks, { type: recorder?.mimeType || "video/webm" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `recording-${stamp()}.webm`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast("録画をWebMで保存しました");
  }

  function downloadImage() {
    if (!emptyState.classList.contains("hidden")) return toast("先に画面または画像を追加してください");
    const link = document.createElement("a");
    link.download = currentFile.textContent || `capture-${stamp()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setSaved("書き出し済み");
    toast("PNGを保存しました");
  }

  async function copyImage() {
    if (!window.ClipboardItem || emptyState.classList.contains("hidden") === false) return toast("コピーする画像がありません");
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast("画像をクリップボードへコピーしました");
    } catch (_) {
      toast("クリップボードを利用できませんでした");
    }
  }

  function createGuide() {
    if (!captures.length && emptyState.classList.contains("hidden")) {
      captures = [{ id: "current", url: canvas.toDataURL("image/png"), name: currentFile.textContent }];
    }
    if (!captures.length) return toast("手順書に使うキャプチャがありません");
    const safeItems = captures.map((item, index) => `
      <section class="step"><div class="number">${index + 1}</div><div class="content">
      <h2>ステップ ${index + 1}</h2><p>画面の内容を確認し、表示されている操作を実行します。</p>
      <img src="${item.url}" alt="ステップ ${index + 1} の画面"></div></section>`).join("");
    const win = window.open("", "_blank");
    if (!win) return toast("ポップアップを許可してください");
    win.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>LUMICAP 手順書</title>
      <style>body{font-family:Arial,"Noto Sans JP",sans-serif;color:#17202a;max-width:900px;margin:60px auto;padding:0 35px}header{border-bottom:4px solid #c9ff52;padding-bottom:25px;margin-bottom:40px}h1{font-size:34px;margin:0 0 10px}header p,.content p{color:#697582}.step{display:grid;grid-template-columns:45px 1fr;gap:20px;margin:0 0 50px;break-inside:avoid}.number{width:38px;height:38px;border-radius:50%;background:#111c2d;color:#c9ff52;display:grid;place-items:center;font-weight:bold}.content h2{margin:6px 0 8px;font-size:20px}.content p{font-size:13px}.content img{width:100%;border:1px solid #dde3e6;border-radius:10px;margin-top:14px}@media print{body{margin:0}.step{break-inside:avoid}}</style></head>
      <body><header><h1>操作手順書</h1><p>LUMICAP Studioで作成 · ${new Date().toLocaleString("ja-JP")}</p></header>${safeItems}<script>setTimeout(()=>print(),500)<\/script></body></html>`);
    win.document.close();
  }

  function readFile(file) {
    if (!file?.type?.startsWith("image/")) return toast("画像ファイルを選択してください");
    const reader = new FileReader();
    reader.onload = () => loadImageSource(reader.result, file.name);
    reader.readAsDataURL(file);
  }

  function clearHistory() {
    if (!captures.length) return toast("履歴は空です");
    if (confirm("このセッションのキャプチャ履歴を消去しますか？")) {
      captures = []; renderThumbs();
      toast("履歴を消去しました");
    }
  }

  function getPlatform() {
    const hinted = navigator.userAgentData?.platform || navigator.platform || "";
    const mobileHint = navigator.userAgentData?.mobile;
    const agent = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(agent) || (hinted === "MacIntel" && navigator.maxTouchPoints > 1)) {
      return { id: "ios", label: "iOS / iPadOS" };
    }
    if (/Android/i.test(hinted) || /Android/i.test(agent) || (mobileHint && /Linux/i.test(hinted))) {
      return { id: "android", label: "Android" };
    }
    if (/Linux|Ubuntu/i.test(hinted)) return { id: "ubuntu", label: "Ubuntu / Linux" };
    if (/Win/i.test(hinted)) return { id: "windows", label: "Windows" };
    return { id: "windows", label: "デスクトップ / PWA" };
  }

  function showInstallDialog() {
    const platform = getPlatform();
    detectedPlatform.textContent = platform.label;
    document.querySelectorAll("[data-platform-card]").forEach((card) => {
      card.classList.toggle("recommended", card.dataset.platformCard === platform.id);
    });
    installNote.textContent = ["android", "ios"].includes(platform.id)
      ? "モバイル版ではOS標準のスクリーンショットを読み込み、注釈・手順書・AIタスク機能を利用できます。"
      : "デスクトップ版では画面キャプチャ、録画、編集、AIタスクをローカルで利用できます。";
    if (!installDialog.open) installDialog.showModal();
  }

  async function installPwa() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice.outcome === "accepted") {
        installDialog.close();
        toast("LUMICAPをインストールしました");
      }
      return;
    }
    const platform = getPlatform();
    if (platform.id === "ios") return showIosHelp();
    installNote.textContent = "ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選択してください。";
    installNote.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showIosHelp() {
    installNote.textContent = "iPhone／iPadではSafariで開き、共有ボタン（□↑）→「ホーム画面に追加」→「追加」の順に選択してください。";
    installNote.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const taskTemplates = {
    bug: `添付する画面キャプチャを分析し、再現可能なバグ報告を日本語で作成してください。
出力: 1.要約 2.発生環境 3.再現手順 4.期待する結果 5.実際の結果 6.原因候補 7.重要度 8.追加確認事項。
画面にない事実は推測と明記し、機密情報らしき内容は引用しないでください。`,
    manual: `添付する画面キャプチャから、初心者でも迷わない日本語の操作手順書を作成してください。
番号付き手順、各操作の目的、確認ポイント、失敗時の対処を含めてください。画面上の文字を正確に読み取り、不明な箇所は「要確認」としてください。`,
    review: `添付するUI画面を専門家としてレビューしてください。
使いやすさ、情報設計、アクセシビリティ、視認性、モバイル対応、操作ミス防止の観点で分析し、改善案を「高・中・低」の優先順位、理由、具体的な修正例とともに日本語で提示してください。`,
    translate: `添付する画面の内容を読み取り、日本語へ翻訳して要約してください。
固有名詞と数値を保持し、重要事項、必要な操作、警告、期限を箇条書きで整理してください。読めない文字を推測で補わないでください。`,
    support: `添付する画面を根拠に、顧客へ送る丁寧で簡潔な日本語のサポート回答を作成してください。
状況への共感、原因の説明、解決手順、解決しない場合に必要な情報を含め、断定できない内容は明確に区別してください。`,
    custom: `添付する画面キャプチャと追加情報をもとに、指定されたタスクを実行してください。
事実と推測を分け、実行可能な結論を日本語で簡潔に提示してください。`
  };

  function selectedPreset() {
    return document.querySelector('input[name="aiPreset"]:checked')?.value || "bug";
  }

  function buildAiPrompt(preset = selectedPreset(), context = document.querySelector("#aiContext")?.value.trim() || "") {
    const base = taskTemplates[preset] || taskTemplates.custom;
    const captureInfo = emptyState.classList.contains("hidden")
      ? `\n\n添付画像情報: ${currentFile.textContent}（${canvas.width} × ${canvas.height}px）`
      : "\n\n画像はまだありません。追加情報だけをもとに進め、不足情報を質問してください。";
    return `${base}${captureInfo}${context ? `\n\n追加情報:\n${context}` : ""}`;
  }

  function openAiDialog(preset) {
    if (preset) {
      const input = document.querySelector(`input[name="aiPreset"][value="${preset}"]`);
      if (input) input.checked = true;
    }
    if (!aiDialog.open) aiDialog.showModal();
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    document.execCommand("copy");
    field.remove();
    return Promise.resolve();
  }

  function prepareCaptureForAi() {
    const attach = document.querySelector("#attachCapture")?.checked;
    if (!attach || !emptyState.classList.contains("hidden")) return false;
    const link = document.createElement("a");
    link.download = `lumicap-ai-context-${stamp()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    return true;
  }

  async function launchAi(provider, preset) {
    const destinations = {
      chatgpt: "https://chatgpt.com/",
      claude: "https://claude.ai/new",
      gemini: "https://gemini.google.com/app"
    };
    const target = destinations[provider];
    if (!target) return;
    if (preset) {
      const input = document.querySelector(`input[name="aiPreset"][value="${preset}"]`);
      if (input) input.checked = true;
    }
    const prompt = buildAiPrompt(preset || selectedPreset());
    window.open(target, "_blank", "noopener,noreferrer");
    try {
      await copyText(prompt);
      const prepared = prepareCaptureForAi();
      aiDialog.open && aiDialog.close();
      toast(prepared ? "指示文をコピーし、添付画像を保存しました" : "指示文をコピーしました。AIへ貼り付けてください");
    } catch {
      toast("AIを開きました。指示文を手動で貼り付けてください");
    }
  }

  async function registerAgentTools() {
    const modelContext = document.modelContext || navigator.modelContext;
    if (!modelContext?.registerTool) return;
    try {
      await modelContext.registerTool({
        name: "prepare_lumicap_ai_task",
        description: "LUMICAPの現在の画面情報から、指定目的のAIタスク指示文をローカルで生成します。",
        inputSchema: {
          type: "object",
          properties: {
            task: { type: "string", enum: Object.keys(taskTemplates) },
            context: { type: "string", description: "タスクに追加する任意の背景情報" }
          },
          required: ["task"]
        },
        execute(input) {
          return { prompt: buildAiPrompt(input.task, input.context || ""), imageAvailable: emptyState.classList.contains("hidden") };
        },
        annotations: { readOnlyHint: true }
      });
    } catch (_) {}
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const actions = {
      capture: captureScreen, record: toggleRecording, "record-stop": stopRecording,
      upload: () => fileInput.click(), download: downloadImage, copy: copyImage,
      undo, guide: createGuide, clear: clearHistory,
      install: showInstallDialog, ai: () => openAiDialog(),
      shortcuts: openShortcutDialog,
      "pwa-install": installPwa, "ios-help": showIosHelp
    };
    actions[button.dataset.action]?.();
  });
  document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => {
    selectTool(button.dataset.tool);
  }));
  document.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-step]").forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
    const data = {
      1: ["01", "キャプチャ範囲を選択"],
      2: ["02", "注釈で要点を強調"],
      3: ["03", "最適な形式で共有"]
    }[button.dataset.step];
    document.querySelector(".stage-number").textContent = data[0];
    document.querySelector(".stage-caption").textContent = data[1];
  }));
  document.querySelectorAll("[data-ai-preset]").forEach((button) => button.addEventListener("click", () => {
    openAiDialog(button.dataset.aiPreset);
  }));
  document.querySelectorAll("[data-provider]").forEach((button) => button.addEventListener("click", () => {
    launchAi(button.dataset.provider);
  }));
  document.querySelectorAll("[data-provider-quick]").forEach((button) => button.addEventListener("click", () => {
    launchAi(button.dataset.providerQuick, "bug");
  }));

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerUp);
  fileInput.addEventListener("change", () => readFile(fileInput.files[0]));
  dropZone.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.style.outline = "2px solid #c9ff52"; });
  dropZone.addEventListener("dragleave", () => { dropZone.style.outline = ""; });
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault(); dropZone.style.outline = ""; readFile(event.dataTransfer.files[0]);
  });
  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const isEditing = target instanceof Element && !!target.closest("input, textarea, select, [contenteditable='true']");
    if (isEditing && event.key !== "Escape") return;

    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (command && event.shiftKey) {
      const actions = {
        "1": captureScreen,
        "2": toggleRecording,
        "3": () => openAiDialog(),
        "4": createGuide,
        "5": () => fileInput.click(),
        "s": downloadImage
      };
      if (actions[key]) {
        event.preventDefault();
        actions[key]();
        return;
      }
    }
    if (command && !event.shiftKey && key === "z") {
      event.preventDefault();
      undo();
      return;
    }
    if (!command && !event.altKey && !event.shiftKey) {
      const tools = { v: "select", p: "pen", a: "arrow", r: "rect", h: "highlight", t: "text", b: "blur" };
      if (tools[key]) {
        event.preventDefault();
        selectTool(tools[key]);
        return;
      }
    }
    if (event.key === "?") {
      event.preventDefault();
      openShortcutDialog();
      return;
    }
    if (event.key === "Escape") {
      if (recorder?.state === "recording") stopRecording();
      [shortcutDialog, installDialog, aiDialog].forEach((dialog) => {
        if (dialog?.open) dialog.close();
      });
    }
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    toast("LUMICAPのインストールが完了しました");
  });

  document.querySelector(".starter")?.addEventListener("click", () => {
    document.querySelectorAll(".thumb").forEach((el) => el.classList.remove("active"));
    document.querySelector(".starter").classList.add("active");
    emptyState.classList.remove("hidden");
    currentFile.textContent = "はじめに.png";
  });

  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  registerAgentTools();
})();
