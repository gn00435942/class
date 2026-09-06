const allowedOrigins = new Set([
  "https://gn00435942.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const MAX_FILES = 8;

const allowedDocumentExts = new Set([
  "pdf", "doc", "docx", "rtf", "odt", "txt", "md", "csv", "xls", "xlsx",
]);
const allowedImageExts = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin)
    ? origin
    : "https://gn00435942.github.io";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

function extension(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function approximateBase64Bytes(data: string) {
  const raw = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  return Math.floor((raw.length * 3) / 4);
}

function normalizeBase64(data: string) {
  return data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
}

type IncomingFile = {
  name: string;
  mimeType?: string;
  dataBase64: string;
};

function validateFiles(value: unknown): { files?: IncomingFile[]; error?: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "請至少提供一個文件。" };
  }
  if (value.length > MAX_FILES) {
    return { error: `一次最多 ${MAX_FILES} 個文件。` };
  }

  let total = 0;
  const files: IncomingFile[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return { error: "文件資料格式不正確。" };
    const raw = item as Record<string, unknown>;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const mimeType = typeof raw.mimeType === "string" ? raw.mimeType.trim() : "";
    const dataBase64 = typeof raw.dataBase64 === "string" ? raw.dataBase64.trim() : "";
    if (!name || !dataBase64) return { error: "文件名稱或內容缺失。" };

    const ext = extension(name);
    if (!allowedDocumentExts.has(ext) && !allowedImageExts.has(ext)) {
      return { error: `不支援的檔案格式：${name}` };
    }

    const bytes = approximateBase64Bytes(dataBase64);
    if (bytes > MAX_FILE_BYTES) {
      return { error: `${name} 超過 15 MB，請先縮小檔案。` };
    }
    total += bytes;
    files.push({ name, mimeType, dataBase64: normalizeBase64(dataBase64) });
  }

  if (total > MAX_TOTAL_BYTES) {
    return { error: "本次文件總大小超過 30 MB，請分批解析。" };
  }
  return { files };
}

const resultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    receiveDate: {
      type: "string",
      description: "收文日期，能確定時用 YYYY-MM-DD；無法確定則空字串。",
    },
    subject: {
      type: "string",
      description: "案件主旨，保留公文核心意旨並適度精簡。",
    },
    content: {
      type: "string",
      description: "承辦人真正需要知道與執行的重點摘要。",
    },
    note: {
      type: "string",
      description: "重要限制、資格、附件說明或其他需要人工注意的事項；無則空字串。",
    },
    outputFiles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "需要製作或繳交的文件名稱。" },
          format: { type: "string", description: "例如 XLSX、DOCX、PDF、紙本、線上表單；不確定則空字串。" },
          source: { type: "string", description: "原始範本、附件、新建文件或其他來源描述。" },
          reference: { type: "string", description: "可辨識時填附件編號、檔名或範本名稱；無則空字串。" },
          channels: {
            type: "array",
            items: { type: "string" },
            description: "此文件需透過哪些交付管道送出，例如線上、紙本、Email、公文系統。",
          },
        },
        required: ["name", "format", "source", "reference", "channels"],
      },
    },
    deliveries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          channel: { type: "string", description: "實際交付管道。" },
          deadline: { type: "string", description: "能確定時用 YYYY-MM-DD；無法確定則空字串。" },
          status: { type: "string", enum: ["未完成", "辦理中", "已完成"] },
          detail: { type: "string", description: "該管道的繳交對象、網址線索、紙本份數或其他必要說明；無則空字串。" },
        },
        required: ["channel", "deadline", "status", "detail"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "AI 無法確定、文件彼此矛盾、期限需人工確認等風險提示。",
    },
  },
  required: ["receiveDate", "subject", "content", "note", "outputFiles", "deliveries", "warnings"],
};

function getOutputText(payload: Record<string, unknown>) {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") return p.text;
    }
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return jsonResponse(req, { error: "AI service is not configured." }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "請以 JSON 格式傳送文件。" }, 400);
  }

  const validation = validateFiles(body.files);
  if (!validation.files) {
    return jsonResponse(req, { error: validation.error }, 400);
  }

  const userContent: Record<string, unknown>[] = [];
  for (const file of validation.files) {
    const ext = extension(file.name);
    const mime = file.mimeType || (ext === "pdf" ? "application/pdf" : "application/octet-stream");
    if (allowedImageExts.has(ext)) {
      userContent.push({
        type: "input_image",
        image_url: `data:${mime};base64,${file.dataBase64}`,
        detail: "high",
      });
    } else {
      const inputFile: Record<string, unknown> = {
        type: "input_file",
        filename: file.name,
        file_data: `data:${mime};base64,${file.dataBase64}`,
      };
      if (ext === "pdf") inputFile.detail = "high";
      userContent.push(inputFile);
    }
  }

  userContent.push({
    type: "input_text",
    text: [
      "請分析以上公文與附件，產生一份『項目控管』草稿。",
      "只根據文件內容判斷，不要虛構不存在的日期、文件或交付方式。",
      "若文件使用民國年，請轉成西元日期（例如民國115年為2026年）。",
      "同一案件如果有線上與紙本等不同交付管道，請拆成不同 deliveries；每個管道可以有不同期限。",
      "outputFiles 代表承辦人需要製作、填寫或繳交的文件；不要把所有收到的附件都當成待交付文件。",
      "若原始附件本身就是官方 XLSX/DOCX 範本，source 應標示為原始範本，reference 優先填可辨識的附件編號或檔名。",
      "無法確定的期限或資訊請留空字串，並把原因寫入 warnings。",
      "所有新建工作一律先標記為未完成。",
    ].join("\n"),
  });

  const requestPayload = {
    model: Deno.env.get("OPENAI_MODEL") || "gpt-5.6-terra",
    store: false,
    input: [
      {
        role: "system",
        content: "你是臺灣國民小學行政承辦工作的文件分析助手。你的任務是把公文與附件轉成可人工確認的結構化案件草稿。重視準確、期限、交付管道、待交付文件與原始範本，不確定時明確標示，不可臆測。",
      },
      { role: "user", content: userContent },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "school_admin_case",
        strict: true,
        schema: resultSchema,
      },
    },
  };

  let openaiResponse: Response;
  try {
    openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });
  } catch {
    return jsonResponse(req, { error: "無法連線至 AI 服務，請稍後再試。" }, 502);
  }

  const rawText = await openaiResponse.text();
  let raw: Record<string, unknown> = {};
  try {
    raw = rawText ? JSON.parse(rawText) : {};
  } catch {
    // handled below
  }

  if (!openaiResponse.ok) {
    const error = raw.error && typeof raw.error === "object"
      ? raw.error as Record<string, unknown>
      : {};
    const message = typeof error.message === "string" ? error.message : "OpenAI request failed";
    console.error("OpenAI error", openaiResponse.status, message);
    return jsonResponse(req, {
      error: "AI 解析失敗，請稍後再試。",
      providerStatus: openaiResponse.status,
    }, 502);
  }

  const outputText = getOutputText(raw);
  if (!outputText) {
    console.error("OpenAI response contained no output_text", raw.status);
    return jsonResponse(req, { error: "AI 沒有回傳可解析的結果。" }, 502);
  }

  let result: unknown;
  try {
    result = JSON.parse(outputText);
  } catch {
    console.error("Structured output was not valid JSON");
    return jsonResponse(req, { error: "AI 回傳格式異常，請再試一次。" }, 502);
  }

  return jsonResponse(req, {
    ok: true,
    service: "analyze-document",
    model: requestPayload.model,
    result,
  });
});
