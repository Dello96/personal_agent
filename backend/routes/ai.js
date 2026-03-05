const express = require("express");
const authenticate = require("../middleware/auth");
const { getOpenAIApiKey, getOpenAIClient } = require("../lib/openaiClient");

const router = express.Router();

router.use(authenticate);

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

router.get("/health", async (req, res) => {
  try {
    const apiKey = getOpenAIApiKey();
    return res.json({
      ok: true,
      model: DEFAULT_MODEL,
      apiKeyConfigured: Boolean(apiKey),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "OpenAI 설정 확인 실패",
    });
  }
});

router.post("/tasks/parse", async (req, res) => {
  const { text, teamMembers = [] } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({
      ok: false,
      error: "text(문자열) 값이 필요합니다.",
    });
  }

  try {
    const client = getOpenAIClient();
    const userName = req.user?.name || "사용자";

    const membersPrompt = Array.isArray(teamMembers)
      ? teamMembers
          .map((m) =>
            `- ${m.name || "이름없음"}${m.email ? ` (${m.email})` : ""}`
          )
          .join("\n")
      : "";

    const completion = await client.responses.create({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      text: {
        format: {
          type: "json_schema",
          name: "task_parse_result",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              assigneeName: { type: ["string", "null"] },
              assigneeEmail: { type: ["string", "null"] },
              dueDate: { type: ["string", "null"] },
              priority: {
                type: "string",
                enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
              },
              confidence: { type: "number" },
              warnings: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "title",
              "description",
              "assigneeName",
              "assigneeEmail",
              "dueDate",
              "priority",
              "confidence",
              "warnings",
            ],
          },
        },
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "너는 한국어 업무 입력을 구조화하는 비서다. 결과는 JSON 스키마에 정확히 맞춰라. " +
                "날짜는 가능한 경우 YYYY-MM-DD로 변환하고, 불명확하면 null로 둔다. " +
                "우선순위는 LOW/MEDIUM/HIGH/URGENT 중 하나만 출력한다.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `요청자: ${userName}\n` +
                `원문: ${text}\n\n` +
                "팀 멤버 목록(선택):\n" +
                `${membersPrompt || "- (없음)"}`,
            },
          ],
        },
      ],
    });

    const parsed = completion.output_parsed;

    return res.json({
      ok: true,
      model: DEFAULT_MODEL,
      parsedTask: parsed,
    });
  } catch (error) {
    console.error("OpenAI 업무 파싱 실패:", error);
    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "업무 자연어 파싱에 실패했습니다. OpenAI 설정을 확인하세요.",
    });
  }
});

module.exports = router;
