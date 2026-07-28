# LUMICAP 1.0 配布状態

最終更新日: 2026年7月29日

## 実装済み

- Web / PWA: 編集、AIタスク、文書化、共有、オフライン、弱視設定
- Chrome Manifest V3: 表示領域、全ページスクロール、固定要素重複抑制、ローカルPNG結合
- Windows / Ubuntu補助アプリ: PrintScreen、グローバルキー、遅延、範囲選択、ズーム、マイク、Webカメラ、WebM / MP4
- 通知領域常駐と `lumicap://` 連携
- Windows NSIS実インストーラー、Ubuntu AppImage / deb BuildKitとCI設定

## 配布時の制約

- Windows版はコード署名証明書がないため未署名です。Windows SmartScreenが警告する場合があります。
- Ubuntu AppImage / debはWindows上で直接生成できないため、公開BuildKitまたはUbuntu CIで生成します。
- Ubuntu版ではWaylandの画面共有確認が表示される場合があります。
- PrintScreenが他アプリに登録済みの場合、`Ctrl+Shift+1` を利用できます。
- Chrome管理画面、ウェブストア、他の拡張機能ページは取得できません。
- Chromeウェブストアの公開確定には、所有者の登録、連絡先、本人確認、最終提出が必要です。
- ChatGPT App Directoryへの最終提出には、OpenAI PlatformのOwner権限による管理画面操作が必要です。
