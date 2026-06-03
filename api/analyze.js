const { readJsonBody, sendJson } = require("./_lib/body");
const { analyzeReferenceOnly } = require("./_lib/reference-only-engine");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "不支持的请求方法。" });
      return;
    }

    const body = await readJsonBody(req);
    if (!body.designProfile) {
      sendJson(res, 400, { error: "缺少设计图特征数据。" });
      return;
    }

    if (!body.referenceProfile) {
      sendJson(res, 400, { error: "请上传指定对比图后再开始分析。" });
      return;
    }

    const result = analyzeReferenceOnly({
      designProfile: body.designProfile,
      referenceProfile: body.referenceProfile,
    });

    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "分析失败。" });
  }
};
