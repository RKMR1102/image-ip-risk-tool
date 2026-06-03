const designInput = document.getElementById("designInput");
const referenceInput = document.getElementById("referenceInput");
const designPreview = document.getElementById("designPreview");
const referencePreview = document.getElementById("referencePreview");
const designHint = document.getElementById("designHint");
const referenceHint = document.getElementById("referenceHint");
const notesInput = document.getElementById("notesInput");
const analyzeButton = document.getElementById("analyzeButton");
const exportButton = document.getElementById("exportButton");

const riskBanner = document.getElementById("riskBanner");
const riskScore = document.getElementById("riskScore");
const shapeMetric = document.getElementById("shapeMetric");
const compositionMetric = document.getElementById("compositionMetric");
const visualMetric = document.getElementById("visualMetric");
const overallMetric = document.getElementById("overallMetric");
const reviewAdvice = document.getElementById("reviewAdvice");
const usageAdvice = document.getElementById("usageAdvice");
const compareDesignPreview = document.getElementById("compareDesignPreview");
const compareMatchPreview = document.getElementById("compareMatchPreview");
const compareMatchLabel = document.getElementById("compareMatchLabel");
const ruleReasons = document.getElementById("ruleReasons");
const riskPoints = document.getElementById("riskPoints");
const suggestions = document.getElementById("suggestions");
const analysisSummary = document.getElementById("analysisSummary");
const referenceSummary = document.getElementById("referenceSummary");

const state = {
  designDataUrl: "",
  designProfile: null,
  referenceDataUrl: "",
  referenceProfile: null,
  lastResult: null,
};

designInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  designHint.textContent = "处理中...";
  const result = await ImageRiskCore.buildProfileFromFile(file);
  state.designDataUrl = result.dataUrl;
  state.designProfile = result.profile;
  designPreview.src = result.dataUrl;
  designPreview.hidden = false;
  compareDesignPreview.src = result.dataUrl;
  designHint.textContent = file.name;
});

referenceInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  referenceHint.textContent = "处理中...";
  const result = await ImageRiskCore.buildProfileFromFile(file);
  state.referenceDataUrl = result.dataUrl;
  state.referenceProfile = result.profile;
  referencePreview.src = result.dataUrl;
  referencePreview.hidden = false;
  compareMatchPreview.src = result.dataUrl;
  referenceHint.textContent = file.name;
});

analyzeButton.addEventListener("click", async () => {
  if (!state.designProfile || !state.referenceProfile) {
    renderFallback(
      ["请同时上传设计图和指定对比图。"],
      ["补齐两张图片后再开始自动比对。"]
    );
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "比对中...";
  try {
    const result = await apiRequest("/api/analyze", {
      method: "POST",
      body: {
        designProfile: state.designProfile,
        referenceProfile: state.referenceProfile,
        notes: notesInput.value.trim(),
        designFileName: designHint.textContent,
        referenceFileName: referenceHint.textContent,
      },
    });

    state.lastResult = {
      analyzedAt: result.analyzedAt,
      notes: notesInput.value.trim(),
      designFile: designHint.textContent,
      referenceFile: referenceHint.textContent,
      response: result,
    };

    renderResult(result);
  } catch (error) {
    renderFallback(
      [`比对失败：${error.message}`],
      ["请确认两张图片都已上传，且分析接口可正常访问。"]
    );
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "开始自动比对";
  }
});

exportButton.addEventListener("click", () => {
  if (!state.lastResult) {
    renderFallback(["当前还没有可导出的分析结果。"], ["请先完成一次自动比对。"]);
    return;
  }

  exportReport(state.lastResult);
});

function renderResult(result) {
  const evaluation = result.evaluation;
  const similarity = result.referenceResult;

  riskBanner.dataset.level = evaluation.level;
  riskBanner.querySelector(".risk-label").textContent = evaluation.label;
  riskScore.textContent = `${evaluation.score}分`;

  shapeMetric.textContent = formatPercent(similarity?.subjectSimilarity);
  compositionMetric.textContent = formatPercent(similarity?.compositionSimilarity);
  visualMetric.textContent = formatPercent(similarity?.visualSimilarity);
  overallMetric.textContent = formatPercent(similarity?.overallSimilarity);
  compareMatchLabel.textContent = `指定对比图｜整体 ${formatPercent(similarity?.overallSimilarity)}`;

  reviewAdvice.textContent = evaluation.reviewAdviceText;
  usageAdvice.textContent = evaluation.usageAdviceText;
  ruleReasons.innerHTML = evaluation.reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  riskPoints.innerHTML = evaluation.riskPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  suggestions.innerHTML = evaluation.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  referenceSummary.textContent = similarity
    ? `指定对比图整体 ${formatPercent(similarity.overallSimilarity)}，主体 ${formatPercent(similarity.subjectSimilarity)}，构图 ${formatPercent(similarity.compositionSimilarity)}，视觉 ${formatPercent(similarity.visualSimilarity)}。`
    : "尚未生成相似度摘要。";

  analysisSummary.textContent = result.evaluation.summary;
}

function renderFallback(risks, advice) {
  riskBanner.dataset.level = "pending";
  riskBanner.querySelector(".risk-label").textContent = "等待分析";
  riskScore.textContent = "0分";
  shapeMetric.textContent = "-";
  compositionMetric.textContent = "-";
  visualMetric.textContent = "-";
  overallMetric.textContent = "-";
  reviewAdvice.textContent = "待分析";
  usageAdvice.textContent = "待分析";
  compareMatchPreview.src = state.referenceDataUrl || "";
  compareMatchLabel.textContent = "等待分析";
  ruleReasons.innerHTML = "<li>暂无规则判定依据。</li>";
  riskPoints.innerHTML = risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  suggestions.innerHTML = advice.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  referenceSummary.textContent = "尚未上传指定对比图。";
  analysisSummary.textContent = "系统将展示本次“设计图 vs 指定对比图”的最终结论。";
}

async function apiRequest(url, options) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function exportReport(result) {
  const response = result.response;
  const similarity = response.referenceResult || {};
  const content = [
    "图像侵权自动比对报告",
    `分析时间：${result.analyzedAt}`,
    `设计图：${result.designFile}`,
    `指定对比图：${result.referenceFile || "无"}`,
    `补充说明：${result.notes || "无"}`,
    "",
    "一、风险结论",
    `风险等级：${response.evaluation.label}`,
    `风险评分：${response.evaluation.score}分`,
    `审核建议：${response.evaluation.reviewAdviceText}`,
    `使用建议：${response.evaluation.usageAdviceText}`,
    "",
    "二、相似度摘要",
    `整体：${formatPercent(similarity.overallSimilarity)}`,
    `主体：${formatPercent(similarity.subjectSimilarity)}`,
    `构图：${formatPercent(similarity.compositionSimilarity)}`,
    `视觉：${formatPercent(similarity.visualSimilarity)}`,
    "",
    "三、规则判定依据",
    ...response.evaluation.reasons.map((item, index) => `${index + 1}. ${item}`),
    "",
    "四、风险关注点",
    ...response.evaluation.riskPoints.map((item, index) => `${index + 1}. ${item}`),
    "",
    "五、修改建议",
    ...response.evaluation.suggestions.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `图像自动比对报告-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatPercent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
