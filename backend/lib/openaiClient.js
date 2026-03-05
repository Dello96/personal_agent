const OpenAI = require("openai");

let cachedClient = null;

function getOpenAIApiKey() {
  // 기존 프로젝트에서 OPEN_API_KEY를 사용 중이므로 하위 호환 유지
  return process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
}

function getOpenAIClient() {
  const apiKey = getOpenAIApiKey();

  if (!apiKey) {
    throw new Error(
      "OpenAI API 키가 없습니다. OPENAI_API_KEY(권장) 또는 OPEN_API_KEY를 설정하세요."
    );
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }

  return cachedClient;
}

module.exports = {
  getOpenAIApiKey,
  getOpenAIClient,
};
