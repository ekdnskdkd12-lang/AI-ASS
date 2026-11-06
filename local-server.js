// 내 PC용 서버 (Node.js 기본 http 모듈)
// 실행: npm run dev
import http from "node:http";
import { handleChat } from "./lib/gemini.js";

const HOST = "127.0.0.1";
const PORT = 3001;
const MAX_BODY_BYTES = 1024 * 1024; // 요청 본문 최대 1MB

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, `http://${HOST}`).pathname;

  if (path !== "/api/chat") {
    return sendJson(res, 404, { error: "없는 주소입니다." });
  }

  // 브라우저 CORS 사전 요청
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "POST 요청만 사용할 수 있습니다." });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    if (err.message === "TOO_LARGE") {
      return sendJson(res, 413, { error: "요청이 너무 큽니다." });
    }
    return sendJson(res, 400, { error: "요청 형식이 올바르지 않습니다." });
  }

  const result = await handleChat(body);
  sendJson(res, result.status, result.body);
});

server.listen(PORT, HOST, () => {
  console.log(`로컬 서버 실행 중: http://${HOST}:${PORT}/api/chat`);
});
