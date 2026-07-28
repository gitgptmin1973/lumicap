export const metadata = {
  title: "サポート | LUMICAP",
};

export default function SupportPage() {
  return (
    <main style={styles.main}>
      <a href="/studio/" style={styles.back}>← LUMICAPへ戻る</a>
      <h1>LUMICAPサポート</h1>
      <p>
        インストール、キャプチャ、ChatGPT App接続に問題がある場合は、次の情報を
        まとめてください。
      </p>
      <ul>
        <li>端末とOSの種類・バージョン</li>
        <li>ブラウザまたはChatGPTアプリのバージョン</li>
        <li>発生した操作と表示されたメッセージ</li>
        <li>機密情報を除いたスクリーンショット</li>
      </ul>
      <h2>よくある確認</h2>
      <p>
        iOSはSafariの共有メニューから「ホーム画面に追加」、Android/Windowsは
        対応ブラウザのインストール案内を利用します。UbuntuはChromium系ブラウザの
        「アプリをインストール」を利用できます。
      </p>
      <p>
        PrintScreenやMP4録画にはWindows / Ubuntu Native Companionが必要です。
        PrintScreenが別のアプリで使用中の場合はCtrl+Shift+1、録画はCtrl+Shift+2を
        利用してください。Windowsの未署名版ではSmartScreenの確認が表示される場合があります。
      </p>
      <p>
        ChatGPT Appは、ChatGPTの設定から公開MCPエンドポイントを接続した後、
        会話で「LUMICAPを使って」と指定します。
      </p>
    </main>
  );
}

const styles = {
  main: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "56px 24px 80px",
    lineHeight: 1.8,
  },
  back: { color: "#25d993", textDecoration: "none" },
};
