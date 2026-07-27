export const metadata = {
  title: "利用規約 | LUMICAP",
};

export default function TermsPage() {
  return (
    <main style={styles.main}>
      <a href="/studio/" style={styles.back}>← LUMICAPへ戻る</a>
      <h1>利用規約</h1>
      <p>最終更新日: 2026年7月27日</p>
      <h2>利用条件</h2>
      <p>
        LUMICAPは画面情報の取得、整理、共有準備を支援するツールです。利用者は、
        キャプチャ対象について必要な権限と同意を得たうえで利用してください。
      </p>
      <h2>AI生成内容</h2>
      <p>
        AIタスクや生成結果には誤りが含まれる可能性があります。公開、送信、業務利用
        の前に利用者が内容を確認してください。LUMICAPは外部AIへの自動送信を行いません。
      </p>
      <h2>禁止事項</h2>
      <p>
        不正アクセス、権利侵害、違法な監視、同意のない機密情報の取得・共有、
        サービス運用を妨げる行為は禁止します。
      </p>
      <h2>変更と提供</h2>
      <p>
        安全性や機能改善のため、機能または本規約を更新することがあります。
        重要な変更は本ページで案内します。
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
