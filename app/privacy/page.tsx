export const metadata = {
  title: "プライバシーポリシー | LUMICAP",
};

export default function PrivacyPage() {
  return (
    <main style={styles.main}>
      <a href="/studio/" style={styles.back}>← LUMICAPへ戻る</a>
      <h1>プライバシーポリシー</h1>
      <p>最終更新日: 2026年7月27日</p>
      <h2>基本方針</h2>
      <p>
        LUMICAPはローカルファーストで動作します。キャプチャ、録画、注釈、OCRの
        内容は、ユーザーが明示的に共有または送信しない限り端末内で処理されます。
      </p>
      <h2>ChatGPT App</h2>
      <p>
        ChatGPT Appは、タスク種別とユーザーが入力した補足文脈を使って指示を準備
        します。LUMICAP独自のサーバーへ画像、会話、個人情報を保存しません。
        ChatGPT上でのデータ取扱いにはOpenAIの利用規約とプライバシーポリシーも
        適用されます。
      </p>
      <h2>保存と共有</h2>
      <p>
        PWA設定や下書きはブラウザのローカルストレージへ保存される場合があります。
        外部サービスを開いた後の送信は、ユーザーが各サービス上で確認して実行します。
      </p>
      <h2>お問い合わせ</h2>
      <p><a href="/support/">サポートページ</a>をご利用ください。</p>
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
