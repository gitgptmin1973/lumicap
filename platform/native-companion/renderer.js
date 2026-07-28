const api = window.lumicapNative;
const sourceList = document.querySelector("#sourceList");
const canvas = document.querySelector("#captureCanvas");
const context = canvas.getContext("2d");
const emptyPreview = document.querySelector("#emptyPreview");
const countdown = document.querySelector("#countdown");
const operationStatus = document.querySelector("#operationStatus");
const saveSelection = document.querySelector("#saveSelection");
const recordButton = document.querySelector("#recordButton");

let sources = [];
let selectedSourceId = null;
let baseImage = null;
let selection = null;
let dragStart = null;
let recorder = null;
let recordingStream = null;
let recordedChunks = [];
let compositionFrame = 0;

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const setStatus = (message) => { operationStatus.textContent = message; };
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function refreshSources(preserveSelection = true) {
  setStatus("画面一覧を取得中…");
  const previous = preserveSelection ? selectedSourceId : null;
  sources = await api.getSources();
  selectedSourceId = sources.some((source) => source.id === previous) ? previous : sources[0]?.id || null;
  sourceList.replaceChildren(...sources.map((source) => {
    const button = document.createElement("button");
    button.className = "source-card";
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(source.id === selectedSourceId));
    button.innerHTML = `<img alt="" src="${source.thumbnail}"><span><b></b><small>${source.id.startsWith("screen:") ? "画面全体" : "ウィンドウ"}</small></span>`;
    button.querySelector("b").textContent = source.name;
    button.addEventListener("click", () => {
      selectedSourceId = source.id;
      sourceList.querySelectorAll(".source-card").forEach((item) => {
        item.setAttribute("aria-selected", String(item === button));
      });
      showSourcePreview(source);
    });
    return button;
  }));
  document.querySelector("#sourceStatus").textContent = `${sources.length}件`;
  if (selectedSourceId) showSourcePreview(sources.find((source) => source.id === selectedSourceId));
  setStatus("準備完了");
}

function showSourcePreview(source) {
  if (!source) return;
  const image = new Image();
  image.onload = () => {
    baseImage = image;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    selection = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    renderSelection();
    emptyPreview.hidden = true;
    saveSelection.disabled = false;
  };
  image.src = source.thumbnail;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height))
  };
}

function normalizedSelection(start, end) {
  return {
    x: Math.round(Math.min(start.x, end.x)),
    y: Math.round(Math.min(start.y, end.y)),
    width: Math.max(1, Math.round(Math.abs(end.x - start.x))),
    height: Math.max(1, Math.round(Math.abs(end.y - start.y)))
  };
}

function renderSelection(pointer = null) {
  if (!baseImage) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  if (selection) {
    context.save();
    context.fillStyle = "rgba(2,8,16,.5)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      baseImage,
      selection.x, selection.y, selection.width, selection.height,
      selection.x, selection.y, selection.width, selection.height
    );
    context.strokeStyle = "#ff4d3f";
    context.lineWidth = Math.max(2, canvas.width / 500);
    context.strokeRect(selection.x, selection.y, selection.width, selection.height);
    context.fillStyle = "#ff4d3f";
    context.font = `700 ${Math.max(14, canvas.width / 70)}px "Segoe UI"`;
    context.fillText(`${selection.width} × ${selection.height}px`, selection.x + 8, Math.max(22, selection.y - 8));
    context.restore();
  }
  if (pointer) drawMagnifier(pointer);
}

function drawMagnifier(pointer) {
  const radius = Math.max(55, canvas.width / 15);
  const zoom = 5;
  const x = Math.min(canvas.width - radius - 8, pointer.x + radius + 15);
  const y = Math.max(radius + 8, pointer.y - radius - 15);
  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.clip();
  context.imageSmoothingEnabled = false;
  context.drawImage(
    baseImage,
    pointer.x - radius / zoom,
    pointer.y - radius / zoom,
    radius * 2 / zoom,
    radius * 2 / zoom,
    x - radius,
    y - radius,
    radius * 2,
    radius * 2
  );
  context.strokeStyle = "#c9ff52";
  context.lineWidth = 3;
  context.beginPath(); context.moveTo(x - radius, y); context.lineTo(x + radius, y); context.stroke();
  context.beginPath(); context.moveTo(x, y - radius); context.lineTo(x, y + radius); context.stroke();
  context.restore();
  context.strokeStyle = "#101923";
  context.lineWidth = 6;
  context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.stroke();
  context.strokeStyle = "#c9ff52";
  context.lineWidth = 3;
  context.stroke();
}

canvas.addEventListener("pointerdown", (event) => {
  if (!baseImage) return;
  dragStart = canvasPoint(event);
  selection = normalizedSelection(dragStart, dragStart);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!baseImage) return;
  const point = canvasPoint(event);
  if (dragStart) selection = normalizedSelection(dragStart, point);
  renderSelection(point);
});
canvas.addEventListener("pointerup", (event) => {
  if (!dragStart) return;
  selection = normalizedSelection(dragStart, canvasPoint(event));
  dragStart = null;
  renderSelection();
  setStatus(`選択範囲 ${selection.width} × ${selection.height}px`);
});
canvas.addEventListener("pointerleave", () => renderSelection());

async function runCountdown() {
  const seconds = Number(document.querySelector("#captureDelay").value);
  for (let remaining = seconds; remaining > 0; remaining -= 1) {
    countdown.hidden = false;
    countdown.textContent = remaining;
    await delay(1000);
  }
  countdown.hidden = true;
}

async function captureStill() {
  if (!selectedSourceId) return setStatus("取得する画面を選択してください");
  await runCountdown();
  await refreshSources(true);
  const source = sources.find((item) => item.id === selectedSourceId);
  if (!source) return setStatus("選択した画面を再取得できませんでした");
  showSourcePreview(source);
  setStatus("静止画を取得しました。ドラッグで範囲を選択できます");
}

async function savePng() {
  if (!baseImage || !selection) return;
  const output = document.createElement("canvas");
  output.width = selection.width;
  output.height = selection.height;
  output.getContext("2d").drawImage(
    baseImage,
    selection.x, selection.y, selection.width, selection.height,
    0, 0, selection.width, selection.height
  );
  const result = await api.savePng({
    dataUrl: output.toDataURL("image/png"),
    suggestedName: `LUMICAP-${stamp()}.png`
  });
  setStatus(result.canceled ? "保存をキャンセルしました" : "PNGを保存しました");
}

async function screenStream(sourceId) {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxFrameRate: 30
      }
    }
  });
}

async function composeRecording(screen, includeCamera, includeMic) {
  const screenVideo = document.createElement("video");
  screenVideo.srcObject = screen;
  screenVideo.muted = true;
  await screenVideo.play();

  let cameraStream = null;
  let cameraVideo = null;
  if (includeCamera) {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    cameraVideo = document.createElement("video");
    cameraVideo.srcObject = cameraStream;
    cameraVideo.muted = true;
    await cameraVideo.play();
  }

  const width = screenVideo.videoWidth || 1920;
  const height = screenVideo.videoHeight || 1080;
  const mixCanvas = document.createElement("canvas");
  mixCanvas.width = width;
  mixCanvas.height = height;
  const mixContext = mixCanvas.getContext("2d");
  const draw = () => {
    mixContext.drawImage(screenVideo, 0, 0, width, height);
    if (cameraVideo) {
      const cameraWidth = Math.round(width * .22);
      const cameraHeight = Math.round(cameraWidth * 9 / 16);
      const x = width - cameraWidth - 24;
      const y = height - cameraHeight - 24;
      mixContext.save();
      mixContext.beginPath();
      mixContext.roundRect(x, y, cameraWidth, cameraHeight, 18);
      mixContext.clip();
      mixContext.drawImage(cameraVideo, x, y, cameraWidth, cameraHeight);
      mixContext.restore();
    }
    compositionFrame = requestAnimationFrame(draw);
  };
  draw();
  const composed = mixCanvas.captureStream(30);

  if (includeMic) {
    const microphone = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    microphone.getAudioTracks().forEach((track) => composed.addTrack(track));
  }
  return {
    stream: composed,
    stop() {
      cancelAnimationFrame(compositionFrame);
      screen.getTracks().forEach((track) => track.stop());
      cameraStream?.getTracks().forEach((track) => track.stop());
      composed.getTracks().forEach((track) => track.stop());
    }
  };
}

async function startRecording() {
  if (!selectedSourceId) return setStatus("録画する画面を選択してください");
  const includeMic = document.querySelector("#includeMic").checked;
  const includeCamera = document.querySelector("#includeCamera").checked;
  const source = await screenStream(selectedSourceId);
  recordingStream = await composeRecording(source, includeCamera, includeMic);
  recordedChunks = [];
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  recorder = new MediaRecorder(recordingStream.stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size) recordedChunks.push(event.data);
  });
  recorder.addEventListener("stop", saveRecording);
  recorder.start(1000);
  recordButton.classList.add("active");
  recordButton.textContent = "■ 録画を停止";
  setStatus("録画中… Ctrl+Shift+2で停止");
}

function stopRecording() {
  if (recorder?.state === "recording") recorder.stop();
  recordingStream?.stop();
}

async function saveRecording() {
  recordButton.classList.remove("active");
  recordButton.textContent = "● 録画を開始";
  setStatus("録画を変換しています…");
  const blob = new Blob(recordedChunks, { type: recorder.mimeType });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const result = await api.saveRecording({
    bytes,
    format: document.querySelector("#recordFormat").value,
    suggestedName: `LUMICAP-recording-${stamp()}`
  });
  setStatus(result.canceled ? "保存をキャンセルしました" : "録画を保存しました");
}

function toggleRecording() {
  if (recorder?.state === "recording") stopRecording();
  else startRecording().catch((error) => setStatus(error.message));
}

document.querySelector("#refreshSources").addEventListener("click", () => refreshSources());
document.querySelector("#captureButton").addEventListener("click", captureStill);
document.querySelector("#saveSelection").addEventListener("click", savePng);
document.querySelector("#recordButton").addEventListener("click", toggleRecording);
document.querySelector("#openStudio").addEventListener("click", () => api.openStudio());

api.onShortcut((action) => {
  if (action === "capture") captureStill();
  if (action === "record") toggleRecording();
});
api.onShortcutStatus((status) => {
  const active = Object.values(status).filter(Boolean).length;
  document.querySelector("#shortcutState").textContent = `グローバルキー ${active}/4 有効`;
});

refreshSources().catch((error) => setStatus(error.message));
