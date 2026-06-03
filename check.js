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

analyzeButton.addEventListener("click", () => {
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
    const result = analyzeReferenceOnly({
      designProfile: state.designProfile,
      referenceProfile: state.referenceProfile,
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
      ["请确认两张图片都能正常读取后再重试。"]
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

function analyzeReferenceOnly({ designProfile, referenceProfile }) {
  const similarity = compareProfiles(designProfile, referenceProfile);
  const patternType = inferPairPatternType(designProfile, referenceProfile);
  const differenceCount = computeDifferenceCount(similarity);
  const subjectChanged = looksSubjectIdentityChanged(similarity);

  let level = "low";
  const reasons = [];

  if (patternType === "single") {
    if (!subjectChanged && similarity.subjectSimilarity >= 0.78 && similarity.visualSimilarity >= 0.68) {
      level = "high";
      reasons.push("判定为单一图案，主体未变且视觉仍较接近，按高风险处理。");
    } else if (!subjectChanged && similarity.subjectSimilarity >= 0.62 && similarity.compositionSimilarity >= 0.6) {
      level = "medium";
      reasons.push("判定为单一图案，主体基本未变，但局部已有调整，按中风险处理。");
    } else {
      level = "low";
      reasons.push("判定为单一图案，主体已变化或整体视觉差异较明显，按低风险处理。");
    }
  } else {
    const differenceRatio = 1 - (similarity.subjectSimilarity * 0.55 + similarity.compositionSimilarity * 0.45);
    if (differenceRatio < 0.28 && similarity.visualSimilarity >= 0.66) {
      level = "high";
      reasons.push(`判定为组合图案，结构差异约 ${Math.round(differenceRatio * 100)}%，且视觉较接近，按高风险处理。`);
    } else if (differenceRatio < 0.42 && similarity.overallSimilarity >= 0.58) {
      level = "medium";
      reasons.push(`判定为组合图案，结构差异约 ${Math.round(differenceRatio * 100)}%，按中风险处理。`);
    } else {
      level = "low";
      reasons.push(`判定为组合图案，结构差异约 ${Math.round(differenceRatio * 100)}%，按低风险处理。`);
    }
  }

  if (differenceCount === 3) {
    level = "low";
    reasons.push("三项核心维度均明显不同，最终按低风险处理。");
  } else if (differenceCount === 2 && level === "high") {
    level = "medium";
    reasons.push("三项核心维度中有 2 项明显不同，高风险下调为中风险。");
  }

  if (similarity.maskSimilarity >= 0.93 && similarity.edgeSimilarity >= 0.86) {
    level = "high";
    reasons.push("轮廓保留度很高，触发“AI 保留原轮廓 = 高风险”规则。");
  }

  reasons.push(
    `整体接近度 ${formatPercent(similarity.overallSimilarity)}，主体 ${formatPercent(similarity.subjectSimilarity)}，构图 ${formatPercent(similarity.compositionSimilarity)}，视觉 ${formatPercent(similarity.visualSimilarity)}。`
  );

  const result = {
    analyzedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    referenceResult: similarity,
    topMatches: [],
    evaluation: {
      level,
      label: levelToLabel(level),
      score: calculateRiskScore(similarity, level),
      reviewAdviceText:
        level === "high"
          ? "建议立即人工复核并暂停使用"
          : level === "medium"
            ? "建议修改后再进行一轮比对"
            : "可进入人工抽检流程",
      usageAdviceText:
        level === "high"
          ? "不建议直接使用"
          : level === "medium"
            ? "修改完成后再评估是否可用"
            : "建议保留记录后谨慎使用",
      riskPoints: buildRiskPoints(similarity),
      suggestions: buildSuggestions(level, patternType, subjectChanged),
      reasons,
      summary: `本次仅执行“设计图 vs 指定对比图”分析，最终给出${levelToLabel(level)}结论。`,
    },
  };

  return result;
}

function compareProfiles(base, target) {
  const colorSimilarity = overlapSimilarity(base.colorHistogram, target.colorHistogram);
  const structureSimilarity = cosineSimilarity(base.gray, target.gray);
  const blockSimilarity = cosineSimilarity(base.blockVector, target.blockVector);
  const maskSimilarity = cosineSimilarity(base.maskVector, target.maskVector);
  const edgeSimilarity = cosineSimilarity(base.edges, target.edges);
  const averageHashSimilarity = hashSimilarity(base.averageHash, target.averageHash);
  const differenceHashSimilarity = hashSimilarity(base.differenceHash, target.differenceHash);

  const subjectSimilarity =
    structureSimilarity * 0.25 +
    blockSimilarity * 0.35 +
    maskSimilarity * 0.4;

  const compositionSimilarity =
    structureSimilarity * 0.35 +
    blockSimilarity * 0.4 +
    maskSimilarity * 0.25;

  const visualSimilarity =
    edgeSimilarity * 0.42 +
    colorSimilarity * 0.18 +
    averageHashSimilarity * 0.2 +
    differenceHashSimilarity * 0.2;

  const overallSimilarity =
    colorSimilarity * 0.18 +
    subjectSimilarity * 0.32 +
    compositionSimilarity * 0.27 +
    visualSimilarity * 0.23;

  return {
    colorSimilarity,
    structureSimilarity,
    blockSimilarity,
    maskSimilarity,
    edgeSimilarity,
    averageHashSimilarity,
    differenceHashSimilarity,
    subjectSimilarity,
    compositionSimilarity,
    visualSimilarity,
    overallSimilarity,
  };
}

function inferPairPatternType(designProfile, targetProfile) {
  const designType = inferPatternType(designProfile);
  const targetType = inferPatternType(targetProfile);
  return designType === "composite" || targetType === "composite" ? "composite" : "single";
}

function inferPatternType(profile) {
  if (!profile) {
    return "composite";
  }

  const compactShape =
    profile.componentCount <= 3 &&
    profile.largestComponentRatio >= 0.48 &&
    profile.coverageRatio <= 0.62;

  return compactShape ? "single" : "composite";
}

function computeDifferenceCount(similarity) {
  const subjectDifferent = similarity.subjectSimilarity < 0.84;
  const compositionDifferent = similarity.compositionSimilarity < 0.74;
  const visualDifferent = similarity.visualSimilarity < 0.74;
  return [subjectDifferent, compositionDifferent, visualDifferent].filter(Boolean).length;
}

function looksSubjectIdentityChanged(similarity) {
  return (
    similarity.subjectSimilarity < 0.58 &&
    (similarity.visualSimilarity < 0.62 || similarity.maskSimilarity < 0.72)
  );
}

function buildRiskPoints(similarity) {
  const items = [];
  if (similarity.subjectSimilarity >= 0.75) {
    items.push("主体轮廓和核心识别关系接近。");
  }
  if (similarity.compositionSimilarity >= 0.7) {
    items.push("主体位置和画面重心接近。");
  }
  if (similarity.visualSimilarity >= 0.66) {
    items.push("线条组织、配色气质或视觉表达仍较接近。");
  }
  if (!items.length) {
    items.push("当前主要风险来自局部元素或结构相似，建议结合人工再复核。");
  }
  return items;
}

function buildSuggestions(level, patternType, subjectChanged) {
  const items = [];
  if (level === "high") {
    items.push("建议优先重做主体轮廓、关键识别细节和整体视觉关系。");
  } else if (level === "medium") {
    items.push("建议在主体、构图或视觉表达上继续拉开差异后再复核。");
  } else {
    items.push("建议保留本次比对记录，并结合人工复核确认使用场景。");
  }

  if (patternType === "single") {
    items.push(subjectChanged ? "单一图案可继续拉开五官、姿态和轮廓差异。" : "单一图案优先修改主体轮廓、五官结构和典型姿态。");
  } else {
    items.push("组合图案优先打散元素排列、数量关系和画面重心。");
  }

  return [...new Set(items)];
}

function calculateRiskScore(similarity, level) {
  const base = Math.round(
    similarity.overallSimilarity * 40 +
    similarity.subjectSimilarity * 25 +
    similarity.compositionSimilarity * 20 +
    similarity.visualSimilarity * 15
  );

  if (level === "high") {
    return Math.max(85, base);
  }
  if (level === "medium") {
    return Math.min(84, Math.max(60, base));
  }
  return Math.min(base, 59);
}

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

function overlapSimilarity(a, b) {
  let overlap = 0;
  let total = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    overlap += Math.min(a[index], b[index]);
    total += Math.max(a[index], b[index]);
  }
  return total === 0 ? 0 : overlap / total;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function hashSimilarity(a, b) {
  const length = Math.min(a.length, b.length);
  if (!length) {
    return 0;
  }
  let different = 0;
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) {
      different += 1;
    }
  }
  return 1 - different / length;
}

function levelToLabel(level) {
  if (level === "high") {
    return "高风险";
  }
  if (level === "medium") {
    return "中风险";
  }
  return "低风险";
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
