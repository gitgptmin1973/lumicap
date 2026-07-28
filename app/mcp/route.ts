const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
};

const WIDGET_URI = "ui://widget/lumicap-task-studio-v2.html";
const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
const PROTOCOL_VERSION = "2025-03-26";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type TaskType =
  | "bug_report"
  | "manual"
  | "ui_review"
  | "translate_summary"
  | "support_reply";

type PlatformType = "windows" | "ubuntu" | "android" | "ios" | "chrome";

const taskCatalog: Record<
  TaskType,
  { label: string; prompt: string; checklist: string[] }
> = {
  bug_report: {
    label: "バグ報告",
    prompt:
      "添付画像または会話の画面情報を分析し、再現手順・期待結果・実際の結果・影響度・追加で必要な情報を含む簡潔なバグ報告を日本語で作成してください。見えていない事実は推測せず、要確認として分けてください。",
    checklist: ["再現手順", "期待結果と実際の結果", "影響度", "要確認事項"],
  },
  manual: {
    label: "操作マニュアル",
    prompt:
      "添付画像または会話の画面情報を基に、初めて使う人向けの操作手順を日本語で作成してください。番号付き手順、画面上の目印、注意点、完了条件を含め、見えていない操作は断定しないでください。",
    checklist: ["前提条件", "番号付き手順", "画面上の目印", "完了条件"],
  },
  ui_review: {
    label: "UIレビュー",
    prompt:
      "添付画像または会話の画面情報を、情報設計・視認性・アクセシビリティ・操作効率・エラー防止の観点でレビューしてください。重要度順に、根拠と具体的な改善案を日本語で示してください。",
    checklist: ["重要度", "観察できる根拠", "改善案", "アクセシビリティ"],
  },
  translate_summary: {
    label: "翻訳＋要約",
    prompt:
      "添付画像または会話内のテキストを日本語へ翻訳し、その後に要点を3〜5項目でまとめてください。固有名詞、数値、警告、ボタン名は原文も併記し、判読できない箇所は明記してください。",
    checklist: ["日本語訳", "要点", "固有名詞と数値", "判読不能箇所"],
  },
  support_reply: {
    label: "サポート返信",
    prompt:
      "添付画像または会話の状況を基に、丁寧で簡潔なカスタマーサポート返信案を日本語で作成してください。共感、状況整理、次の一手、必要な追加情報を含め、解決を保証しないでください。",
    checklist: ["共感", "状況整理", "次の一手", "追加で必要な情報"],
  },
};

function originFrom(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

function widgetHtml() {
  const presets = Object.entries(taskCatalog)
    .map(
      ([key, value]) =>
        `<button class="task" data-task="${key}"><strong>${value.label}</strong><span>${value.checklist[0]}から作成</span></button>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
    *{box-sizing:border-box}body{margin:0;padding:14px;background:transparent;color:var(--text,#17211d)}
    .shell{border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:22px;padding:18px;background:linear-gradient(145deg,rgba(20,184,121,.13),rgba(20,184,121,.02));box-shadow:0 18px 55px rgba(5,35,24,.10)}
    .top{display:flex;align-items:center;gap:12px}.mark{width:42px;height:42px;border-radius:13px;background:#12c77d;display:grid;place-items:center;color:#032819;font-weight:900;box-shadow:0 8px 24px rgba(18,199,125,.28)}
    h1{font-size:18px;margin:0;letter-spacing:.04em}.sub{font-size:12px;opacity:.66;margin-top:2px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:16px}
    button{font:inherit;color:inherit}.task,.open{border:1px solid color-mix(in srgb,currentColor 13%,transparent);background:color-mix(in srgb,Canvas 92%,#12c77d 8%);border-radius:14px;text-align:left;padding:12px;cursor:pointer;transition:.18s transform,.18s border-color}
    .task:hover{transform:translateY(-2px);border-color:#12c77d}.task strong,.task span{display:block}.task strong{font-size:13px}.task span{font-size:10px;opacity:.62;margin-top:4px}
    .open{width:100%;margin-top:10px;text-align:center;background:#12c77d;color:#032819;border-color:#12c77d;font-weight:800}
    .status{min-height:18px;margin:10px 2px 0;font-size:11px;opacity:.68}
    @media(max-width:480px){body{padding:8px}.grid{grid-template-columns:1fr}.shell{padding:14px}}
    @media(prefers-color-scheme:dark){body{--text:#eef8f3}.shell{background:linear-gradient(145deg,rgba(18,199,125,.16),rgba(3,24,17,.72))}.task{background:rgba(255,255,255,.055)}}
  </style>
</head>
<body>
  <main class="shell">
    <div class="top"><div class="mark">L</div><div><h1>LUMICAP TASK STUDIO</h1><div class="sub">画面情報から、使える成果物へ</div></div></div>
    <div class="grid">${presets}</div>
    <button class="open" id="openStudio">LUMICAPを開く ↗</button>
    <div class="status" id="status">タスクを選ぶとChatGPTへ指示を送ります。</div>
  </main>
  <script>
    const catalog=${JSON.stringify(taskCatalog).replaceAll("<", "\\u003c")};
    const state={studioUrl:"",selected:""};
    const status=document.getElementById("status");
    function applyGlobals(globals){
      const output=globals&&globals.toolOutput;
      if(output&&output.studioUrl) state.studioUrl=output.studioUrl;
      if(output&&output.taskType) state.selected=output.taskType;
    }
    applyGlobals(window.openai||{});
    window.addEventListener("openai:set_globals",event=>applyGlobals(event.detail&&event.detail.globals));
    document.querySelectorAll("[data-task]").forEach(button=>{
      button.addEventListener("click",async()=>{
        const key=button.dataset.task;
        const item=catalog[key];
        status.textContent=item.label+"をChatGPTへ送信しています…";
        try{
          if(window.openai&&window.openai.sendFollowUpMessage){
            await window.openai.sendFollowUpMessage({prompt:item.prompt});
            status.textContent=item.label+"の作成を依頼しました。";
          }else{
            window.parent.postMessage({jsonrpc:"2.0",method:"ui/message",params:{role:"user",content:[{type:"text",text:item.prompt}]}}, "*");
            status.textContent=item.label+"の指示を準備しました。";
          }
        }catch(error){status.textContent="送信できませんでした。もう一度お試しください。"}
      });
    });
    document.getElementById("openStudio").addEventListener("click",async()=>{
      const href=state.studioUrl||location.origin+"/studio/";
      try{
        if(window.openai&&window.openai.openExternal) await window.openai.openExternal({href});
        else window.open(href,"_blank","noopener");
      }catch(error){status.textContent="LUMICAPを開けませんでした。"}
    });
  </script>
</body>
</html>`;
}

function appMeta(origin: string) {
  return {
    ui: {
      resourceUri: WIDGET_URI,
      domain: origin,
      csp: {
        connectDomains: [origin],
        resourceDomains: [origin],
        redirectDomains: [origin],
      },
    },
    "openai/outputTemplate": WIDGET_URI,
    "openai/toolInvocation/invoking": "LUMICAPタスクを準備中",
    "openai/toolInvocation/invoked": "LUMICAPタスクを準備しました",
    "openai/widgetAccessible": true,
  };
}

function toolDescriptors(origin: string) {
  const sharedAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  return [
    {
      name: "create_capture_task",
      title: "LUMICAPタスクを作成",
      description:
        "画面・画像・会話の文脈から、バグ報告、操作マニュアル、UIレビュー、翻訳要約、またはサポート返信を作るための安全なタスクを準備します。画像そのものを保存または外部送信しません。",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          task_type: {
            type: "string",
            enum: Object.keys(taskCatalog),
            description: "作成する成果物の種類",
          },
          context: {
            type: "string",
            maxLength: 2000,
            description: "補足文脈。機密情報は含めないでください。",
          },
        },
        required: ["task_type"],
      },
      outputSchema: {
        type: "object",
        properties: {
          version: { type: "integer" },
          taskType: { type: "string" },
          label: { type: "string" },
          prompt: { type: "string" },
          checklist: { type: "array", items: { type: "string" } },
          studioUrl: { type: "string" },
        },
        required: [
          "version",
          "taskType",
          "label",
          "prompt",
          "checklist",
          "studioUrl",
        ],
      },
      annotations: sharedAnnotations,
      _meta: appMeta(origin),
    },
    {
      name: "open_lumicap_studio",
      title: "LUMICAPを開く",
      description:
        "公開済みLUMICAP PWAのURLと、端末へのインストール案内を表示します。自動インストールや外部送信は行いません。",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          workflow: {
            type: "string",
            enum: ["capture", "record", "annotate", "ocr", "ai_task", "platform"],
            description: "開きたいワークフロー",
          },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          version: { type: "integer" },
          studioUrl: { type: "string" },
          installGuide: { type: "string" },
        },
        required: ["version", "studioUrl", "installGuide"],
      },
      annotations: sharedAnnotations,
      _meta: appMeta(origin),
    },
    {
      name: "get_lumicap_platform",
      title: "LUMICAPの導入方法を確認",
      description:
        "Windows、Ubuntu、Android、iOS、Chromeのうち指定された環境に必要なLUMICAP構成、公式配布URL、ショートカット、安全上の制約を表示します。インストールは実行しません。",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          platform: {
            type: "string",
            enum: ["windows", "ubuntu", "android", "ios", "chrome"],
            description: "導入先のOSまたはブラウザ",
          },
        },
        required: ["platform"],
      },
      outputSchema: {
        type: "object",
        properties: {
          version: { type: "integer" },
          platform: { type: "string" },
          components: { type: "array", items: { type: "string" } },
          links: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          shortcuts: { type: "array", items: { type: "string" } },
          approvalRequired: { type: "boolean" },
          note: { type: "string" },
        },
        required: [
          "version",
          "platform",
          "components",
          "links",
          "shortcuts",
          "approvalRequired",
          "note",
        ],
      },
      annotations: sharedAnnotations,
      _meta: appMeta(origin),
    },
  ];
}

function success(id: JsonRpcRequest["id"], result: unknown, status = 200) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }),
    { status, headers: JSON_HEADERS },
  );
}

function failure(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
  status = 400,
) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    }),
    { status, headers: JSON_HEADERS },
  );
}

function textResult(
  message: string,
  structuredContent: Record<string, unknown>,
) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent,
  };
}

export async function POST(request: Request) {
  let rpc: JsonRpcRequest;
  try {
    rpc = (await request.json()) as JsonRpcRequest;
  } catch {
    return failure(null, -32700, "Parse error");
  }

  if (rpc.jsonrpc !== "2.0" || !rpc.method) {
    return failure(rpc.id, -32600, "Invalid Request");
  }

  const origin = originFrom(request);

  if (rpc.method === "initialize") {
    const requestedVersion =
      typeof rpc.params?.protocolVersion === "string"
        ? rpc.params.protocolVersion
        : PROTOCOL_VERSION;
    return success(rpc.id, {
      protocolVersion: requestedVersion,
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
      },
      serverInfo: { name: "lumicap-chatgpt-app", version: "1.0.0" },
      instructions:
        "LUMICAPは画面情報を整理する読み取り専用Appです。ユーザーの確認なしに外部送信や端末インストールを行いません。",
    });
  }

  if (rpc.method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: JSON_HEADERS });
  }

  if (rpc.method === "ping") {
    return success(rpc.id, {});
  }

  if (rpc.method === "tools/list") {
    return success(rpc.id, { tools: toolDescriptors(origin) });
  }

  if (rpc.method === "resources/list") {
    return success(rpc.id, {
      resources: [
        {
          uri: WIDGET_URI,
          name: "LUMICAP Task Studio",
          description: "ChatGPT内でタスクを選択するLUMICAPウィジェット",
          mimeType: RESOURCE_MIME_TYPE,
          _meta: appMeta(origin),
        },
      ],
    });
  }

  if (rpc.method === "resources/read") {
    if (rpc.params?.uri !== WIDGET_URI) {
      return failure(rpc.id, -32602, "Unknown resource URI");
    }
    return success(rpc.id, {
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml(),
          _meta: appMeta(origin),
        },
      ],
    });
  }

  if (rpc.method === "tools/call") {
    const name = rpc.params?.name;
    const args =
      rpc.params?.arguments && typeof rpc.params.arguments === "object"
        ? (rpc.params.arguments as Record<string, unknown>)
        : {};
    const studioUrl = `${origin}/studio/`;

    if (name === "create_capture_task") {
      const taskType = args.task_type;
      if (
        typeof taskType !== "string" ||
        !(taskType in taskCatalog)
      ) {
        return failure(rpc.id, -32602, "task_type is required");
      }
      const item = taskCatalog[taskType as TaskType];
      const context =
        typeof args.context === "string" && args.context.trim()
          ? `\n\n補足文脈:\n${args.context.trim().slice(0, 2000)}`
          : "";
      const data = {
        version: 1,
        taskType,
        label: item.label,
        prompt: `${item.prompt}${context}`,
        checklist: item.checklist,
        studioUrl,
      };
      return success(
        rpc.id,
        textResult(
          `${item.label}のタスクを準備しました。表示されたボタンからChatGPTへ依頼できます。`,
          data,
        ),
      );
    }

    if (name === "open_lumicap_studio") {
      return success(
        rpc.id,
        textResult("LUMICAPを開き、ブラウザの案内から端末に追加できます。", {
          version: 1,
          studioUrl,
          installGuide:
            "Windows/Ubuntu/Android/iOSでLUMICAPを開き、アプリ内の「インストール」またはブラウザの「ホーム画面に追加」を選択してください。",
        }),
      );
    }

    if (name === "get_lumicap_platform") {
      const platform = args.platform;
      if (
        typeof platform !== "string" ||
        !["windows", "ubuntu", "android", "ios", "chrome"].includes(platform)
      ) {
        return failure(rpc.id, -32602, "platform is required");
      }
      const downloads =
        "https://github.com/gitgptmin1973/lumicap/releases/download/v1.0.0";
      const catalog: Record<
        PlatformType,
        {
          components: string[];
          links: Record<string, string>;
          shortcuts: string[];
          note: string;
        }
      > = {
        windows: {
          components: ["Web / PWA", "Native Companion", "Chrome拡張（任意）"],
          links: {
            studio: studioUrl,
            installer: `${downloads}/LUMICAP-Setup-1.0.0.exe`,
            chromeExtension: `${downloads}/LUMICAP-Chrome-Extension-v1.0.0.zip`,
          },
          shortcuts: ["PrintScreen", "Ctrl+Shift+1", "Ctrl+Shift+2", "Ctrl+Shift+3"],
          note: "未署名インストーラーではWindows SmartScreenが確認を表示する場合があります。",
        },
        ubuntu: {
          components: ["Web / PWA", "Native Companion", "Chrome拡張（任意）"],
          links: {
            studio: studioUrl,
            buildKit: `${downloads}/LUMICAP-Ubuntu-BuildKit-v1.0.0.zip`,
            chromeExtension: `${downloads}/LUMICAP-Chrome-Extension-v1.0.0.zip`,
          },
          shortcuts: ["PrintScreen", "Ctrl+Shift+1", "Ctrl+Shift+2", "Ctrl+Shift+3"],
          note: "公開中のBuildKitはUbuntu上でAppImageとdebを一発生成します。Wayland環境ではOSの画面共有確認が表示される場合があります。",
        },
        android: {
          components: ["Web / PWA"],
          links: { studio: studioUrl },
          shortcuts: ["OS標準スクリーンショット後に画像を読み込み"],
          note: "Chromeの「アプリをインストール」または「ホーム画面に追加」を利用します。",
        },
        ios: {
          components: ["Web / PWA"],
          links: { studio: studioUrl },
          shortcuts: ["OS標準スクリーンショット後に画像を読み込み"],
          note: "Safariの共有メニューから「ホーム画面に追加」を利用します。",
        },
        chrome: {
          components: ["Chrome拡張", "Web / PWA"],
          links: {
            studio: studioUrl,
            extensionPackage: `${downloads}/LUMICAP-Chrome-Extension-v1.0.0.zip`,
          },
          shortcuts: ["Ctrl+Shift+1（表示領域）", "Ctrl+Shift+5（ページ全体）"],
          note: "利用者が操作した現在タブだけへ一時的にアクセスします。",
        },
      };
      const selected = catalog[platform as PlatformType];
      return success(
        rpc.id,
        textResult(
          `${platform}向けのLUMICAP構成と導入先を確認しました。各端末で初回承認が必要です。`,
          {
            version: 1,
            platform,
            ...selected,
            approvalRequired: true,
          },
        ),
      );
    }

    return failure(rpc.id, -32602, "Unknown tool");
  }

  return failure(rpc.id, -32601, "Method not found", 404);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...JSON_HEADERS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
    },
  });
}

export function GET() {
  return new Response(
    JSON.stringify({
      name: "LUMICAP ChatGPT App MCP Server",
      status: "ok",
      transport: "streamable-http",
      endpoint: "/mcp",
    }),
    { status: 200, headers: JSON_HEADERS },
  );
}
