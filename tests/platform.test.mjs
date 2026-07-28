import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Chrome package uses least-privilege Manifest V3 activation", async () => {
  const manifest = JSON.parse(await read("platform/chrome-extension/manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, "116");
  assert.ok(manifest.permissions.includes("activeTab"));
  assert.ok(manifest.permissions.includes("scripting"));
  assert.ok(!manifest.permissions.includes("tabs"));
  assert.equal(manifest.content_scripts, undefined);
  for (const icon of Object.values(manifest.icons)) {
    await access(new URL(`platform/chrome-extension/${icon}`, root));
  }
});

test("Chrome capture is locked, on-demand, and avoids popup action conflicts", async () => {
  const [worker, content, offscreen] = await Promise.all([
    read("platform/chrome-extension/service-worker.js"),
    read("platform/chrome-extension/content.js"),
    read("platform/chrome-extension/offscreen.js"),
  ]);
  assert.match(worker, /chrome\.storage\.session/);
  assert.match(worker, /chrome\.scripting\.executeScript/);
  assert.doesNotMatch(worker, /tab\.url/);
  assert.doesNotMatch(worker, /chrome\.action\.onClicked/);
  assert.doesNotMatch(worker, /\.then\(/);
  assert.doesNotMatch(content, /\.then\(/);
  assert.doesNotMatch(offscreen, /\.then\(/);
  assert.match(content, /index % 250/);
});

test("Native companion exposes required global shortcuts and hardened boundaries", async () => {
  const [main, renderer, packageJson] = await Promise.all([
    read("platform/native-companion/main.js"),
    read("platform/native-companion/renderer.js"),
    read("platform/native-companion/package.json"),
  ]);
  const configuration = JSON.parse(packageJson);
  assert.match(main, /globalShortcut\.register\("PrintScreen"/);
  assert.match(main, /CommandOrControl\+Shift\+1/);
  assert.match(main, /CommandOrControl\+Shift\+2/);
  assert.match(main, /new Tray/);
  assert.match(main, /app\.asar\.unpacked/);
  assert.match(main, /bytes instanceof Uint8Array/);
  assert.match(renderer, /new Uint8Array\(await blob\.arrayBuffer\(\)\)/);
  assert.deepEqual(configuration.build.protocols[0].schemes, ["lumicap"]);
  assert.ok(configuration.build.linux.target.includes("AppImage"));
  assert.ok(configuration.build.linux.target.includes("deb"));
});

test("Cross-platform build and submission documentation are included", async () => {
  await Promise.all([
    access(new URL(".github/workflows/lumicap-platform-build.yml", root)),
    access(new URL("platform/native-companion/build-ubuntu.sh", root)),
    access(new URL("platform/chrome-extension/CHROMEWEBSTORE.md", root)),
    access(new URL("platform/chrome-extension/PRIVACY.md", root)),
    access(new URL("platform/protocol/lumicap-capture.schema.json", root)),
  ]);
});

