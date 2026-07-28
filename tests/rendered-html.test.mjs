import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function request(pathname, init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://lumicap.example${pathname}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function rpc(method, params, id = 1) {
  return request("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

test("root sends visitors to the published LUMICAP PWA", async () => {
  const response = await request("/");
  assert.ok([301, 302, 307, 308].includes(response.status));
  assert.equal(new URL(response.headers.get("location")).pathname, "/studio/");
  await access(new URL("../public/studio/index.html", import.meta.url));
  const html = await readFile(
    new URL("../public/studio/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /LUMICAP/);
  assert.match(html, /PUBLIC PWA · CHATGPT APP/);
  assert.match(html, /data-action="pwa-install"/);
  assert.match(html, /id="shortcutDialog"/);
  assert.match(html, /id="visionDialog"/);
  assert.match(html, /data-text-scale="xlarge"/);
  assert.match(html, /id="accessibilityStatus"/);
  assert.match(html, /id="platformStatus"/);
  assert.match(html, /LUMICAP 3-LAYER PLATFORM/);
  assert.match(html, /LUMICAP-Setup-1\.0\.0\.exe/);
  assert.match(html, /LUMICAP-Chrome-Extension-v1\.0\.0\.zip/);
  assert.match(html, /github\.com\/gitgptmin1973\/lumicap\/releases\/download\/v1\.0\.0/);
  assert.match(html, /aria-keyshortcuts="Control\+Shift\+1 Meta\+Shift\+1"/);
});

test("keyboard shortcuts cover capture, record, AI, export, and editor tools", async () => {
  const script = await readFile(
    new URL("../public/studio/app.js", import.meta.url),
    "utf8",
  );
  assert.match(script, /"1": captureScreen/);
  assert.match(script, /"2": toggleRecording/);
  assert.match(script, /"3": \(\) => openAiDialog\(\)/);
  assert.match(script, /"4": createGuide/);
  assert.match(script, /"5": \(\) => fileInput\.click\(\)/);
  assert.match(script, /"s": downloadImage/);
  assert.match(
    script,
    /v: "select", p: "pen", a: "arrow", r: "rect", h: "highlight", t: "text", b: "blur"/,
  );
  assert.match(script, /event\.key === "\?"/);
  assert.match(script, /input, textarea, select/);
  assert.match(script, /"6": openVisionDialog/);
});

test("low-vision preferences persist and include strong focus and OS accessibility fallbacks", async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL("../public/studio/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/studio/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(script, /lumicap-accessibility-v1/);
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /dataset\.contrast/);
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(styles, /outline: 4px solid var\(--focus\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /html\[data-text-scale="xlarge"\]/);
});

test("health endpoint reports the production service", async () => {
  const response = await request("/api/health");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    ok: true,
    service: "lumicap-chatgpt-app",
    version: "1.0.0",
  });
});

test("MCP initializes and advertises safe LUMICAP tools", async () => {
  const initialized = await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1" },
  });
  assert.equal(initialized.status, 200);
  const initBody = await initialized.json();
  assert.equal(initBody.result.serverInfo.name, "lumicap-chatgpt-app");
  assert.equal(initBody.result.protocolVersion, "2025-03-26");

  const listed = await rpc("tools/list", {});
  const listBody = await listed.json();
  assert.deepEqual(
    listBody.result.tools.map((tool) => tool.name),
    ["create_capture_task", "open_lumicap_studio", "get_lumicap_platform"],
  );
  for (const tool of listBody.result.tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(
      tool._meta["openai/outputTemplate"],
      "ui://widget/lumicap-task-studio-v2.html",
    );
  }
});

test("MCP returns a submission-ready UI resource", async () => {
  const response = await rpc("resources/read", {
    uri: "ui://widget/lumicap-task-studio-v2.html",
  });
  const body = await response.json();
  const resource = body.result.contents[0];
  assert.equal(resource.mimeType, "text/html;profile=mcp-app");
  assert.equal(resource._meta.ui.domain, "https://lumicap.example");
  assert.deepEqual(resource._meta.ui.csp.resourceDomains, [
    "https://lumicap.example",
  ]);
  assert.match(resource.text, /sendFollowUpMessage/);
  assert.match(resource.text, /LUMICAP TASK STUDIO/);
});

test("get_lumicap_platform returns explicit components, shortcuts, and approval boundary", async () => {
  const response = await rpc("tools/call", {
    name: "get_lumicap_platform",
    arguments: { platform: "windows" },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  const result = body.result.structuredContent;
  assert.equal(result.platform, "windows");
  assert.equal(result.approvalRequired, true);
  assert.ok(result.components.includes("Native Companion"));
  assert.ok(result.shortcuts.includes("PrintScreen"));
  assert.match(result.links.installer, /LUMICAP-Setup-1\.0\.0\.exe$/);
});

test("create_capture_task validates inputs and returns structured content", async () => {
  const invalid = await rpc("tools/call", {
    name: "create_capture_task",
    arguments: { task_type: "delete_everything" },
  });
  assert.equal(invalid.status, 400);
  const invalidBody = await invalid.json();
  assert.equal(invalidBody.error.code, -32602);

  const valid = await rpc("tools/call", {
    name: "create_capture_task",
    arguments: { task_type: "bug_report", context: "保存ボタンで停止" },
  });
  assert.equal(valid.status, 200);
  const validBody = await valid.json();
  assert.equal(validBody.result.structuredContent.taskType, "bug_report");
  assert.equal(validBody.result.structuredContent.version, 1);
  assert.match(validBody.result.structuredContent.prompt, /保存ボタンで停止/);
  assert.equal(
    validBody.result.structuredContent.studioUrl,
    "https://lumicap.example/studio/",
  );
});
