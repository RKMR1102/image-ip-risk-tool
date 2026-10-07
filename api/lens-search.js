function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "不支持的请求方法。" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const imageUrl = String(body.imageUrl || "");
    const apiKey = process.env.SERPAPI_KEY || process.env.SerpApi;
    if (!apiKey) {
      sendJson(res, 503, { error: "尚未配置 Google Lens 搜图接口。" });
      return;
    }
    if (!/^https:\/\//i.test(imageUrl)) {
      sendJson(res, 400, { error: "图片地址不正确。" });
      return;
    }

    const params = new URLSearchParams({ engine: "google_lens", url: imageUrl, api_key: apiKey, hl: "zh-CN" });
    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    const data = await response.json();
    if (!response.ok || data.error) {
      sendJson(res, 502, { error: data.error || "Google Lens 搜图接口暂时不可用。" });
      return;
    }

    const matches = (data.visual_matches || []).slice(0, 10).map((item, index) => ({
      rank: index + 1,
      title: item.title || "未命名结果",
      source: item.source || "",
      link: item.link || "",
      thumbnail: item.thumbnail || item.image || "",
      image: item.image || item.thumbnail || "",
    }));
    sendJson(res, 200, { matches });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "搜图失败。" });
  }
};
