// Gemini 연결 확인용 스크립트
// 실행: node --env-file=.env check-gemini.js
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// 혹시 오류 메시지에 키가 섞여 나와도 가려서 출력
function hideKey(text) {
  const s = String(text ?? "");
  return apiKey ? s.split(apiKey).join("***") : s;
}

if (!apiKey) {
  console.error("실패: GEMINI_API_KEY가 비어 있습니다. .env 파일을 확인하세요.");
  process.exit(1);
}

console.log(`사용 모델: ${model}`);

try {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: '"연결 성공"이라고 한 문장으로만 답해줘.',
  });
  console.log("Gemini 응답:", response.text);
} catch (err) {
  console.error("실패");
  console.error("상태 코드:", err?.status ?? "없음");
  console.error("메시지:", hideKey(err?.message));
  process.exit(1);
}
