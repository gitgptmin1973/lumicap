(() => {
  if (globalThis.__lumicapCaptureLoaded) return;
  globalThis.__lumicapCaptureLoaded = true;

  let originalScrollX = 0;
  let originalScrollY = 0;
  let hiddenFixed = [];

  const nextPaint = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  function pageMetrics() {
    const root = document.documentElement;
    const body = document.body;
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      totalWidth: Math.max(root.scrollWidth, body?.scrollWidth || 0, window.innerWidth),
      totalHeight: Math.max(root.scrollHeight, body?.scrollHeight || 0, window.innerHeight),
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }

  const yieldToPage = () => new Promise((resolve) => setTimeout(resolve, 0));

  async function hideRepeatedFixedElements() {
    hiddenFixed = [];
    const elements = document.querySelectorAll("body *");
    for (let index = 0; index < elements.length; index += 1) {
      const element = elements[index];
      const style = getComputedStyle(element);
      if (style.position === "fixed" || style.position === "sticky") {
        const record = {
          element,
          visibility: element.style.visibility,
          pointerEvents: element.style.pointerEvents
        };
        hiddenFixed.push(record);
        element.style.visibility = "hidden";
        element.style.pointerEvents = "none";
      }
      if (index > 0 && index % 250 === 0) await yieldToPage();
    }
  }

  function restoreFixedElements() {
    hiddenFixed.forEach(({ element, visibility, pointerEvents }) => {
      element.style.visibility = visibility;
      element.style.pointerEvents = pointerEvents;
    });
    hiddenFixed = [];
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "LUMICAP_PREPARE") {
      void (async () => {
        originalScrollX = window.scrollX;
        originalScrollY = window.scrollY;
        window.scrollTo(0, 0);
        await nextPaint();
        sendResponse({ ok: true, ...pageMetrics() });
      })();
      return true;
    }

    if (message.type === "LUMICAP_SCROLL") {
      void (async () => {
        if (message.index > 0 && hiddenFixed.length === 0) await hideRepeatedFixedElements();
        window.scrollTo(0, message.y);
        await nextPaint();
        sendResponse({ ok: true, actualY: window.scrollY });
      })();
      return true;
    }

    if (message.type === "LUMICAP_RESTORE") {
      void (async () => {
        restoreFixedElements();
        window.scrollTo(originalScrollX, originalScrollY);
        await nextPaint();
        sendResponse({ ok: true });
      })();
      return true;
    }
  });
})();
