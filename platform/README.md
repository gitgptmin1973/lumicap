# LUMICAP Platform Suite

LUMICAPを3層で構成する配布ソースです。

- 公開リポジトリ: https://github.com/gitgptmin1973/lumicap
- 配布物: https://github.com/gitgptmin1973/lumicap/releases/tag/v1.0.0

## 構成

1. **Web / PWA**
   - 公開版: https://lumicap-chatgpt-app.minopro.workers.dev/studio/
   - 編集、AIタスク、文書化、共有、オフライン利用
2. **Chrome拡張**
   - 表示領域キャプチャ
   - ページ全体のスクロールキャプチャ
   - PNG保存後にLUMICAP Studioを開く
3. **Windows / Ubuntuネイティブ補助アプリ**
   - PrintScreenとグローバルショートカット
   - 画面・ウィンドウ選択
   - 遅延キャプチャ
   - WebM録画とFFmpegによるMP4変換
   - 通知領域での常駐動作
   - `lumicap://capture` / `lumicap://record` によるPWA連携

## 共通ショートカット

| 操作 | キー |
| --- | --- |
| キャプチャ | `PrintScreen` / `Ctrl+Shift+1` |
| 録画開始・停止 | `Ctrl+Shift+2` |
| LUMICAP Studioを開く | `Ctrl+Shift+3` |
| 見やすさ設定 | `Ctrl+Shift+6` |

Chromeでは `Ctrl+Shift+5` でページ全体のスクロールキャプチャを実行できます。

## 安全設計

- キャプチャ画像と動画は既定で端末内に保存します。
- AIサービスへ画像や文章を自動送信しません。
- Chrome拡張は利用者が操作した現在タブだけを取得します。
- OSのグローバルキー登録と画面取得は、補助アプリの初回インストール承認後にだけ有効になります。
- ChatGPTへのサインインだけで全端末へ無確認インストールすることは、OSの安全制限上行いません。同一アカウントでは各端末の初回承認後にPWA設定を同期できます。

## ビルド

### Chrome

`chrome-extension` フォルダーをChromeの「パッケージ化されていない拡張機能を読み込む」で選択します。

### Windows

```powershell
cd native-companion
npm install
npm run dist:win
```

### Ubuntu

```bash
cd native-companion
npm install
npm run dist:linux
```

生成物は `native-companion/release` に出力されます。
