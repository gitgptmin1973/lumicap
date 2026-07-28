async function loadBitmap(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

async function stitch({ captures, totalHeight, viewportHeight }) {
  const first = await loadBitmap(captures[0].dataUrl);
  const scale = first.height / viewportHeight;
  const outputWidth = first.width;
  const outputHeight = Math.max(1, Math.round(totalHeight * scale));
  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);

  for (let index = 0; index < captures.length; index += 1) {
    const item = captures[index];
    const bitmap = index === 0 ? first : await loadBitmap(item.dataUrl);
    const targetY = Math.round(item.actualY * scale);
    const remainingHeight = outputHeight - targetY;
    const drawHeight = Math.min(bitmap.height, remainingHeight);
    if (drawHeight > 0) {
      context.drawImage(bitmap, 0, 0, bitmap.width, drawHeight, 0, targetY, outputWidth, drawHeight);
    }
    bitmap.close();
  }

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "LUMICAP_STITCH") return;
  void (async () => {
    try {
      sendResponse({ ok: true, dataUrl: await stitch(message.payload) });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "画像を結合できませんでした"
      });
    }
  })();
  return true;
});
