const OpenAI = require("openai");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
    return;
  }

  const { designImage, referenceImage, notes } = req.body || {};
  if (!designImage || !referenceImage) {
    res.status(400).json({ error: "designImage and referenceImage are required" });
    return;
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

    const response = await client.responses.create({
      model,
      max_output_tokens: 1200,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "你是图像侵权风险初筛助手。你会比较设计图和对比图，并输出严格 JSON。重点任务：1) 判断是否出现知名品牌、IP角色、logo或高度可识别的品牌视觉元素；2) 判断图案类型是单一图案还是组合图案；3) 判断元素差异是否达到50%以上；4) 判断视觉印象是否不同；5) 判断主要图案元素是否不同；6) 判断设计图是否像是AI或重绘后保留了原图轮廓。只返回 JSON，不要返回 markdown。",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "请用中文输出 JSON，对字段做保守判断。若明确识别到品牌/IP或角色，应将 brandRisk 设为 yes，并在 brandOrIpNames 中写出名称。若无法确定，不要乱猜。JSON 字段必须包含：patternType, brandRisk, brandOrIpNames, elementDifferenceLevel, visualDifference, mainElementDifferent, aiOutlineRisk, summary, evidence。notes: " +
                (notes || "无"),
            },
            {
              type: "input_text",
              text: "第一张图是设计图，第二张图是对比图。",
            },
            {
              type: "input_image",
              image_url: designImage,
              detail: "high",
            },
            {
              type: "input_image",
              image_url: referenceImage,
              detail: "high",
            },
          ],
        },
      ],
    });

    const raw = response.output_text || "";
    const parsed = parseJsonPayload(raw);
    const assessment = normalizeAssessment(parsed);

    res.status(200).json({
      model,
      assessment,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Unknown server error",
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

function parseJsonPayload(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Model response was not valid JSON");
    }
    return JSON.parse(match[0]);
  }
}

function normalizeAssessment(payload) {
  return {
    patternType: payload.patternType === "composite" ? "composite" : "single",
    brandRisk: payload.brandRisk === "yes" ? "yes" : "no",
    brandOrIpNames: Array.isArray(payload.brandOrIpNames)
      ? payload.brandOrIpNames.filter(Boolean).map(String).slice(0, 8)
      : [],
    elementDifferenceLevel: payload.elementDifferenceLevel === "lt50" ? "lt50" : "ge50",
    visualDifference: payload.visualDifference === "no" ? "no" : "yes",
    mainElementDifferent: payload.mainElementDifferent === "no" ? "no" : "yes",
    aiOutlineRisk: payload.aiOutlineRisk === "yes" ? "yes" : "no",
    summary: typeof payload.summary === "string" ? payload.summary.trim() : "",
    evidence: Array.isArray(payload.evidence)
      ? payload.evidence.filter(Boolean).map(String).slice(0, 6)
      : [],
  };
}
