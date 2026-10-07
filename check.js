const designInput = document.getElementById("designInput");
const referenceInput = document.getElementById("referenceInput");
const designPreview = document.getElementById("designPreview");
const referencePreview = document.getElementById("referencePreview");
const designHint = document.getElementById("designHint");
const referenceHint = document.getElementById("referenceHint");
const notesInput = document.getElementById("notesInput");
const analyzeButton = document.getElementById("analyzeButton");
const exportButton = document.getElementById("exportButton");
const searchDesignButton = document.getElementById("searchDesignButton");
const searchReferenceButton = document.getElementById("searchReferenceButton");

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
const confidenceSummary = document.getElementById("confidenceSummary");
const lensResults = document.getElementById("lensResults");
const lensResultsGrid = document.getElementById("lensResultsGrid");
const lensResultsHint = document.getElementById("lensResultsHint");
const lensOpenLink = document.getElementById("lensOpenLink");

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

searchDesignButton.addEventListener("click", () => {
  submitToGoogleLens(designInput, "设计图");
});

searchReferenceButton.addEventListener("click", () => {
  submitToGoogleLens(referenceInput, "指定对比图");
});

async function submitToGoogleLens(fileInput, label) {
  const file = fileInput.files?.[0];
  if (!file) {
    window.alert(`请先上传${label}。`);
    return;
  }

  const button = fileInput === designInput ? searchDesignButton : searchReferenceButton;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "上传中...";
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const response = await fetch("/api/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, fileName: file.name, contentType: file.type }),
    });
    const result = await response.json();
    if (!response.ok || !result.url) {
      throw new Error(result.error || "图片上传失败。");
    }

    const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(result.url)}`;
    lensOpenLink.href = lensUrl;
    lensOpenLink.hidden = false;
    button.textContent = "获取前十项...";
    const searchResponse = await fetch("/api/lens-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: result.url }),
    });
    const searchResult = await searchResponse.json();
    if (!searchResponse.ok) {
      throw new Error(searchResult.error || "搜图结果获取失败。");
    }
    renderLensResults(searchResult.matches || []);
  } catch (error) {
    window.alert(`无法打开 Google 搜图：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function renderLensResults(matches) {
  lensResults.hidden = false;
  if (!matches.length) {
    lensResultsHint.textContent = "未取得可展示的结果，请在 Google Lens 页面查看。";
    lensResultsGrid.innerHTML = "";
    return;
  }
  lensResultsHint.textContent = `已取得 ${matches.length} 项结果；点击“对比此结果”即可在当前页面分析。`;
  lensResultsGrid.innerHTML = matches.map((match) => `
    <article class="result-box lens-result-card">
      <img src="${escapeHtml(match.thumbnail)}" alt="搜图结果 ${match.rank}" loading="lazy" />
      <strong>${match.rank}. ${escapeHtml(match.title)}</strong>
      <p>${escapeHtml(match.source || "未知来源")}</p>
      <div class="button-row">
        <a href="${escapeHtml(match.link)}" target="_blank" rel="noopener">查看来源</a>
        <button type="button" data-lens-image="${escapeHtml(match.image)}">对比此结果</button>
      </div>
    </article>
  `).join("");
  lensResultsGrid.querySelectorAll("[data-lens-image]").forEach((button) => {
    button.addEventListener("click", () => compareLensResult(button.dataset.lensImage));
  });
}

async function compareLensResult(imageUrl) {
  try {
    if (!state.designProfile) {
      window.alert("请先上传设计图。");
      return;
    }
    const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`);
    if (!response.ok) throw new Error("结果图片暂不允许读取，请打开来源页后下载再上传对比。");
    const file = new File([await response.blob()], "google-lens-result.jpg", { type: response.headers.get("content-type") || "image/jpeg" });
    const result = await ImageRiskCore.buildProfileFromFile(file);
    const comparison = analyzeReferenceOnly({
      designProfile: state.designProfile,
      referenceProfile: result.profile,
      notes: notesInput.value.trim(),
    });
    state.referenceDataUrl = result.dataUrl;
    state.referenceProfile = result.profile;
    compareMatchPreview.src = result.dataUrl;
    compareMatchPreview.hidden = false;
    renderResult(comparison);
    document.getElementById("riskBanner")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    window.alert(`无法直接读取该结果图片：${error.message}`);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("无法读取图片文件。"));
    reader.readAsDataURL(file);
  });
}

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
      notes: notesInput.value.trim(),
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

function analyzeReferenceOnly({ designProfile, referenceProfile, notes = "" }) {
  const similarity = compareProfiles(designProfile, referenceProfile);
  const patternType = inferPairPatternType(designProfile, referenceProfile);
  const differenceCount = computeDifferenceCount(similarity);
  const subjectChanged = looksSubjectIdentityChanged(similarity);
  const textSignals = detectTextRiskSignals(notes);

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

  if (similarity.overallSimilarity >= 0.9 && similarity.subjectSimilarity >= 0.86) {
    level = "high";
    reasons.push("整体与主体同时达到近重复阈值，触发高风险规则。");
  }

  if (patternType === "composite" && similarity.compositionSimilarity >= 0.78 && similarity.visualSimilarity >= 0.78) {
    level = "high";
    reasons.push("组合图案的排列关系与视觉表达均接近，触发高风险规则。");
  }

  if (textSignals.protected) {
    level = "high";
    reasons.push("补充说明命中商标、品牌、赛事或明确 IP 线索，按高风险进入人工复核。");
  }

  if (textSignals.directCopy && level === "low") {
    level = "medium";
    reasons.push("补充说明包含‘一样/几乎一样/原图’等直接复制线索，不能仅按低视觉相似度放行。");
  }

  if (textSignals.license) {
    reasons.push("检测到授权或图库许可线索；许可不等于视觉相似风险消失，仍需核验购买记录、许可类型和使用范围。");
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
      score: calculateRiskScore(similarity, level, textSignals),
      confidence: calculateConfidence(similarity),
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
      summary: `本次执行“设计图 vs 指定对比图”分析，给出${levelToLabel(level)}结论；规则重点参考主体、构图、整体视觉及文字/IP线索。自动判断仅作初筛，建议结合来源和授权情况人工复核。`,
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

function detectTextRiskSignals(notes) {
  const text = String(notes || "").toLowerCase();
  return {
    protected: /(商标|注册|品牌|赛事|ip|版权|影视|角色|logo|trademark|disney|nike|nba|nfl)/i.test(text),
    directCopy: /(一样|一模一样|几乎一样|原图|不改|无需修改|保持不变|看不出来哪里改|直接使用)/i.test(text),
    license: /(授权|许可|增强版|购买|shutterstock|license|licensed)/i.test(text),
  };
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

function calculateRiskScore(similarity, level, textSignals = {}) {
  const base = Math.round(
    similarity.overallSimilarity * 35 +
    similarity.subjectSimilarity * 30 +
    similarity.compositionSimilarity * 25 +
    similarity.visualSimilarity * 10 +
    (textSignals.protected ? 15 : 0) +
    (textSignals.directCopy ? 8 : 0)
  );

  if (level === "high") {
    return Math.max(85, base);
  }
  if (level === "medium") {
    return Math.min(84, Math.max(60, base));
  }
  return Math.min(base, 59);
}

function calculateConfidence(similarity) {
  const dimensions = [
    similarity.subjectSimilarity,
    similarity.compositionSimilarity,
    similarity.visualSimilarity,
  ];
  const mean = dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length;
  const variance = dimensions.reduce((sum, value) => sum + (value - mean) ** 2, 0) / dimensions.length;
  const agreement = Math.max(0, 1 - Math.sqrt(variance) * 2.4);
  const separation = Math.min(1, Math.abs(mean - 0.5) * 1.4);
  return Math.round((0.55 + agreement * 0.25 + separation * 0.2) * 100);
}

function renderResult(result) {
  const evaluation = result.evaluation;
  const similarity = result.referenceResult;

  riskBanner.dataset.level = evaluation.level;
  riskBanner.querySelector(".risk-label").textContent = evaluation.label;
  riskScore.textContent = `${evaluation.score}分`;
  if (confidenceSummary) confidenceSummary.textContent = `自动判断置信度：${evaluation.confidence || 0}%（仅作初筛，仍需人工核验来源和授权）`;

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

  if (referenceSummary) {
    referenceSummary.textContent = similarity
      ? `指定对比图整体 ${formatPercent(similarity.overallSimilarity)}，主体 ${formatPercent(similarity.subjectSimilarity)}，构图 ${formatPercent(similarity.compositionSimilarity)}，视觉 ${formatPercent(similarity.visualSimilarity)}。`
      : "尚未生成相似度摘要。";
  }

  if (analysisSummary) analysisSummary.textContent = result.evaluation.summary;
}

function renderFallback(risks, advice) {
  riskBanner.dataset.level = "pending";
  riskBanner.querySelector(".risk-label").textContent = "等待分析";
  riskScore.textContent = "0分";
  if (confidenceSummary) confidenceSummary.textContent = "自动判断置信度：等待分析";
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
  if (referenceSummary) referenceSummary.textContent = "尚未上传指定对比图。";
  if (analysisSummary) analysisSummary.textContent = "系统将展示本次“设计图 vs 指定对比图”的最终结论。";
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
