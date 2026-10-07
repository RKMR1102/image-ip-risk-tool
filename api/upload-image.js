const { put } = require("@vercel/blob");

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error("图片文件过大，请选择 10MB 以内的图片。"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "不支持的请求方法。" });
    return;
  }

  try {
    const body = JSON.parse(await readBody(req));
    const match = String(body.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      sendJson(res, 400, { error: "图片数据格式不正确。" });
      return;
    }

    const contentType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
      sendJson(res, 400, { error: "图片文件过大，请选择 10MB 以内的图片。" });
      return;
    }

    const originalName = String(body.fileName || "image").replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(`lens/${Date.now()}-${originalName}`, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });

    sendJson(res, 200, { url: blob.url });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "图片上传失败。" });
  }
};
