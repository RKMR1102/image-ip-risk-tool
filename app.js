const designInput = document.getElementById("designInput");
const referenceInput = document.getElementById("referenceInput");
const analyzeButton = document.getElementById("analyzeButton");
const exportButton = document.getElementById("exportButton");

const designPreview = document.getElementById("designPreview");
const referencePreview = document.getElementById("referencePreview");
const designHint = document.getElementById("designHint");
const referenceHint = document.getElementById("referenceHint");

const backendStatus = document.getElementById("backendStatus");
const patternTypeValue = document.getElementById("patternTypeValue");
const brandRiskValue = document.getElementById("brandRiskValue");
const elementDifferenceValue = document.getElementById("elementDifferenceValue");
const visualDifferenceValue = document.getElementById("visualDifferenceValue");
const mainElementDifferentValue = document.getElementById("mainElementDifferentValue");
const aiOutlineRiskValue = document.getElementById("aiOutlineRiskValue");
const notesInput = document.getElementById("notesInput");

const riskBanner = document.getElementById("riskBanner");
const riskScore = document.getElementById("riskScore");
const shapeMetric = document.getElementById("shapeMetric");
const colorMetric = document.getElementById("colorMetric");
const edgeMetric = document.getElementById("edgeMetric");
const overallMetric = document.getElementById("overallMetric");
const reviewAdvice = document.getElementById("reviewAdvice");
const usageAdvice = document.getElementById("usageAdvice");
const riskPoints = document.getElementById("riskPoints");
const suggestions = document.getElementById("suggestions");
const analysisSummary = document.getElementById("analysisSummary");

const state = {
  designImage: null,
  referenceImage: null,
  lastResult: null,
};

const THRESHOLDS = {
  colorDifferentMax: 0.78,
  compositionDifferentMax: 0.8,
  styleDifferentMax: 0.8,
};

designInput.addEventListener("change", (event) => {
  handleImageSelection(event.target.files?.[0], "design");
});

referenceInput.addEventListener("change", (event) => {
  handleImageSelection(event.target.files?.[0], "reference");
});

analyzeButton.addEventListener("click", async () => {
  if (!state.designImage || !state.referenceImage) {
    renderFallback(
      ["请先上传设计图和对比图。"],
      ["保证两张图片都已加载，再重新点击开始分析。"],
      "pending",
      0
    );
    setBackendStatus("后端状态：等待分析", "");
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "分析中...";
  setBackendStatus("后端状态：正在调用自动识别接口...", "");

  try {
    const metrics = await compareImages(state.designImage, state.referenceImage);
    const designDataUrl = imageToUploadDataUrl(state.designImage);
    const referenceDataUrl = imageToUploadDataUrl(state.referenceImage);
    const autoAssessment = await analyzeWithServer({
      designImage: designDataUrl,
      referenceImage: referenceDataUrl,
      notes: notesInput.value.trim(),
    });

    renderAutoAssessment(autoAssessment);

    const evaluation = evaluateRisk(metrics, autoAssessment);
    state.lastResult = {
      analyzedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      metrics,
      assessment: autoAssessment,
      evaluation,
      designFile: designHint.textContent,
      referenceFile: referenceHint.textContent,
      notes: notesInput.value.trim(),
    };

    renderResult(metrics, evaluation, autoAssessment);
    setBackendStatus(`后端状态：识别完成（模型：${autoAssessment.model}）`, "success");
  } catch (error) {
    renderFallback(
      ["自动识别失败，当前无法完成完整分析。"],
      ["请检查 Vercel 是否已配置 OPENAI_API_KEY，并确认接口部署成功。"],
      "pending",
      0
    );
    resetAutoAssessment();
    analysisSummary.textContent = `错误信息：${error.message}`;
    setBackendStatus(`后端状态：识别失败 - ${error.message}`, "error");
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "开始自动分析";
  }
});

exportButton.addEventListener("click", () => {
  if (!state.lastResult) {
    renderFallback(
      ["当前还没有可导出的分析结果。"],
      ["请先完成一次分析，再导出报告。"],
      "pending",
      0
    );
    return;
  }

  exportReport(state.lastResult);
});

function handleImageSelection(file, type) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const image = await loadImage(reader.result);

    if (type === "design") {
      state.designImage = image;
      designPreview.src = reader.result;
      designPreview.hidden = false;
      designHint.textContent = file.name;
    } else {
      state.referenceImage = image;
      referencePreview.src = reader.result;
      referencePreview.hidden = false;
      referenceHint.textContent = file.name;
    }

    resetAutoAssessment();
    setBackendStatus("后端状态：等待分析", "");
  };

  reader.readAsDataURL(file);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取图片"));
    image.src = src;
  });
}

function imageToUploadDataUrl(image) {
  const maxSize = 1024;
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function analyzeWithServer(payload) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "接口调用失败");
  }

  return {
    ...data.assessment,
    model: data.model || "unknown",
  };
}

async function compareImages(designImage, referenceImage) {
  const size = 64;
  const designData = extractImageData(designImage, size);
  const referenceData = extractImageData(referenceImage, size);

  const grayA = toGrayscale(designData.pixels);
  const grayB = toGrayscale(referenceData.pixels);
  const edgesA = detectEdges(grayA, size);
  const edgesB = detectEdges(grayB, size);

  const shapeSimilarity = cosineSimilarity(grayA, grayB);
  const edgeSimilarity = cosineSimilarity(edgesA, edgesB);
  const colorSimilarity = histogramSimilarity(designData.pixels, referenceData.pixels);
  const sizeRatio = getSizeRatio(designImage, referenceImage);
  const compositionSimilarity = shapeSimilarity * 0.7 + sizeRatio * 0.3;
  const overallSimilarity = (
    colorSimilarity * 0.34 +
    compositionSimilarity * 0.33 +
    edgeSimilarity * 0.33
  );

  return {
    colorSimilarity,
    compositionSimilarity,
    edgeSimilarity,
    overallSimilarity,
  };
}

function extractImageData(image, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  const scale = Math.min(size / image.width, size / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  return {
    pixels: context.getImageData(0, 0, size, size).data,
  };
}

function toGrayscale(pixels) {
  const result = new Float32Array(pixels.length / 4);
  for (let index = 0; index < pixels.length; index += 4) {
    result[index / 4] =
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114;
  }
  return normalize(result);
}

function detectEdges(grayscale, width) {
  const result = new Float32Array(grayscale.length);
  for (let y = 1; y < width - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx =
        -grayscale[index - width - 1] -
        2 * grayscale[index - 1] -
        grayscale[index + width - 1] +
        grayscale[index - width + 1] +
        2 * grayscale[index + 1] +
        grayscale[index + width + 1];
      const gy =
        -grayscale[index - width - 1] -
        2 * grayscale[index - width] -
        grayscale[index - width + 1] +
        grayscale[index + width - 1] +
        2 * grayscale[index + width] +
        grayscale[index + width + 1];
      result[index] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return normalize(result);
}

function normalize(values) {
  let max = 0;
  for (const value of values) {
    if (value > max) {
      max = value;
    }
  }

  if (max === 0) {
    return values;
  }

  const normalized = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    normalized[index] = values[index] / max;
  }
  return normalized;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function histogramSimilarity(pixelsA, pixelsB) {
  const bucketsA = new Array(24).fill(0);
  const bucketsB = new Array(24).fill(0);

  fillHistogram(bucketsA, pixelsA);
  fillHistogram(bucketsB, pixelsB);

  let overlap = 0;
  let total = 0;
  for (let index = 0; index < bucketsA.length; index += 1) {
    overlap += Math.min(bucketsA[index], bucketsB[index]);
    total += Math.max(bucketsA[index], bucketsB[index]);
  }

  if (total === 0) {
    return 0;
  }

  return overlap / total;
}

function fillHistogram(buckets, pixels) {
  for (let index = 0; index < pixels.length; index += 4) {
    const rBucket = Math.min(7, Math.floor((pixels[index] / 256) * 8));
    const gBucket = Math.min(7, Math.floor((pixels[index + 1] / 256) * 8));
    const bBucket = Math.min(7, Math.floor((pixels[index + 2] / 256) * 8));

    buckets[rBucket] += 1;
    buckets[8 + gBucket] += 1;
    buckets[16 + bBucket] += 1;
  }
}

function getSizeRatio(imageA, imageB) {
  const areaA = imageA.width * imageA.height;
  const areaB = imageB.width * imageB.height;
  const minArea = Math.min(areaA, areaB);
  const maxArea = Math.max(areaA, areaB);
  return maxArea === 0 ? 0 : minArea / maxArea;
}

function evaluateRisk(metrics, assessment) {
  const riskPointsList = [];
  const suggestionList = [];

  const colorDifferent = metrics.colorSimilarity < THRESHOLDS.colorDifferentMax;
  const compositionDifferent = metrics.compositionSimilarity < THRESHOLDS.compositionDifferentMax;
  const styleDifferent = metrics.edgeSimilarity < THRESHOLDS.styleDifferentMax;
  const differentCount = [colorDifferent, compositionDifferent, styleDifferent].filter(Boolean).length;

  if (assessment.brandRisk === "yes") {
    riskPointsList.push(`自动识别到品牌/IP高风险元素：${assessment.brandOrIpNames.join("、") || "未命名实体"}`);
    suggestionList.push("删除品牌/IP相关元素，替换为原创主体和原创细节后再重新评估。");
    return buildResult(98, "high", differentCount, colorDifferent, compositionDifferent, styleDifferent, riskPointsList, suggestionList);
  }

  if (assessment.aiOutlineRisk === "yes") {
    riskPointsList.push("自动识别判断 AI 结果保留了原图轮廓，按规则直接判定为高风险。");
    suggestionList.push("不要沿用原图轮廓重绘，建议重做主体外轮廓和整体画面逻辑。");
    return buildResult(96, "high", differentCount, colorDifferent, compositionDifferent, styleDifferent, riskPointsList, suggestionList);
  }

  let overallLevel = "low";
  if (differentCount <= 1) {
    overallLevel = "high";
    riskPointsList.push("配色、构图、画法三项中仅0到1项不同，按规则属于高风险。");
    suggestionList.push("至少把三项中的两项明显拉开，建议优先调整构图，再改配色或画法。");
  } else if (differentCount === 2) {
    overallLevel = "medium";
    riskPointsList.push("配色、构图、画法三项中有2项不同，按规则属于中风险。");
  } else {
    riskPointsList.push("配色、构图、画法三项均不同，按规则属于低风险。");
  }

  let patternLevel = "low";
  if (assessment.patternType === "single") {
    if (assessment.mainElementDifferent === "no" && assessment.visualDifference === "no") {
      patternLevel = "high";
      riskPointsList.push("单一图案中主体没变且视觉接近，按规则属于高风险。");
      suggestionList.push("更换主要图案元素，或显著调整主体轮廓、动作、表情和关键细节。");
    } else if (assessment.mainElementDifferent === "no" && assessment.visualDifference === "yes") {
      patternLevel = "medium";
      riskPointsList.push("单一图案中主体没变但视觉不同，按规则属于中风险。");
      suggestionList.push("虽然视觉有所调整，但建议继续拉开主体差异，避免停留在同一主体的小改。");
    } else if (assessment.mainElementDifferent === "yes" && assessment.visualDifference === "yes") {
      riskPointsList.push("单一图案中主体已变化且视觉不同，按规则属于低风险。");
    } else {
      patternLevel = "medium";
      riskPointsList.push("单一图案中主体已变化，但视觉印象仍较接近，按规则从严归为中风险。");
      suggestionList.push("主体虽然已换，但还应继续调整风格或构图，拉开整体视觉印象。");
    }
  } else {
    if (assessment.elementDifferenceLevel === "lt50") {
      patternLevel = "high";
      riskPointsList.push("组合图案的元素差异比例低于50%，按规则属于高风险。");
      suggestionList.push("增加新元素或替换原有元素组合，确保整体组成元素至少50%不同。");
    } else if (assessment.visualDifference === "no") {
      patternLevel = "medium";
      riskPointsList.push("组合图案元素差异已达到50%以上，但视觉印象仍接近，按规则属于中风险。");
      suggestionList.push("进一步重做相同元素的轮廓、比例、姿态或表现方式，拉开视觉印象。");
    } else {
      riskPointsList.push("组合图案元素差异达到50%以上，且视觉印象不同，按规则属于低风险。");
    }
  }

  if (assessment.summary) {
    riskPointsList.push(`自动识别摘要：${assessment.summary}`);
  }

  if (assessment.evidence?.length) {
    assessment.evidence.forEach((item) => riskPointsList.push(`识别依据：${item}`));
  }

  if (suggestionList.length === 0) {
    suggestionList.push("继续保持配色、构图和画法上的差异，并保留创作过程记录。");
  }

  const level = highestLevel(overallLevel, patternLevel);
  const score = scoreFromLevel(level, metrics.overallSimilarity);
  return buildResult(score, level, differentCount, colorDifferent, compositionDifferent, styleDifferent, riskPointsList, suggestionList);
}

function buildResult(score, level, differentCount, colorDifferent, compositionDifferent, styleDifferent, riskPointsList, suggestionList) {
  const label = level === "high" ? "高风险" : level === "medium" ? "中风险" : "低风险";
  const reviewAdviceText =
    level === "high"
      ? "建议立即转人工复核并重做"
      : level === "medium"
        ? "建议设计主管复核后再修改"
        : "可进入人工抽检流程";
  const usageAdviceText =
    level === "high"
      ? "不建议直接使用"
      : level === "medium"
        ? "修改后再评估是否可用"
        : "保留过程文件后可谨慎使用";
  const differenceSummary =
    `配色${colorDifferent ? "不同" : "接近"}、` +
    `构图${compositionDifferent ? "不同" : "接近"}、` +
    `画法${styleDifferent ? "不同" : "接近"}，` +
    `共 ${differentCount} 项满足差异要求。`;

  return {
    score,
    level,
    label,
    reviewAdviceText,
    usageAdviceText,
    differenceSummary,
    riskPoints: uniqueList(riskPointsList),
    suggestions: uniqueList(suggestionList),
  };
}

function highestLevel(first, second) {
  const rank = { low: 1, medium: 2, high: 3 };
  return rank[first] >= rank[second] ? first : second;
}

function scoreFromLevel(level, overallSimilarity) {
  const baseline = Math.round(overallSimilarity * 100);
  if (level === "high") {
    return Math.max(85, baseline);
  }
  if (level === "medium") {
    return Math.max(58, Math.min(74, baseline));
  }
  return Math.min(38, baseline);
}

function uniqueList(items) {
  return [...new Set(items)];
}

function renderAutoAssessment(assessment) {
  patternTypeValue.textContent = translatePatternType(assessment.patternType);
  brandRiskValue.textContent =
    assessment.brandRisk === "yes"
      ? `高风险${assessment.brandOrIpNames.length ? `：${assessment.brandOrIpNames.join("、")}` : ""}`
      : "未识别到明显品牌/IP";
  elementDifferenceValue.textContent = translateElementDifference(assessment.elementDifferenceLevel);
  visualDifferenceValue.textContent = assessment.visualDifference === "yes" ? "视觉印象不同" : "视觉印象接近";
  mainElementDifferentValue.textContent = assessment.mainElementDifferent === "yes" ? "主要元素不同" : "主要元素未明显变化";
  aiOutlineRiskValue.textContent = assessment.aiOutlineRisk === "yes" ? "疑似保留原轮廓" : "未识别到明显轮廓复用";
}

function resetAutoAssessment() {
  patternTypeValue.textContent = "待识别";
  brandRiskValue.textContent = "待识别";
  elementDifferenceValue.textContent = "待识别";
  visualDifferenceValue.textContent = "待识别";
  mainElementDifferentValue.textContent = "待识别";
  aiOutlineRiskValue.textContent = "待识别";
}

function renderResult(metrics, evaluation, assessment) {
  riskBanner.dataset.level = evaluation.level;
  riskBanner.querySelector(".risk-label").textContent = evaluation.label;
  riskScore.textContent = `${evaluation.score}分`;

  shapeMetric.textContent = formatPercent(metrics.colorSimilarity);
  colorMetric.textContent = formatPercent(metrics.compositionSimilarity);
  edgeMetric.textContent = formatPercent(metrics.edgeSimilarity);
  overallMetric.textContent = formatPercent(metrics.overallSimilarity);
  reviewAdvice.textContent = evaluation.reviewAdviceText;
  usageAdvice.textContent = evaluation.usageAdviceText;

  riskPoints.innerHTML = evaluation.riskPoints.map((item) => `<li>${item}</li>`).join("");
  suggestions.innerHTML = evaluation.suggestions.map((item) => `<li>${item}</li>`).join("");

  analysisSummary.textContent =
    `${evaluation.differenceSummary}` +
    ` 自动识别摘要：${assessment.summary || "无"}。` +
    ` 当前后端模型：${assessment.model}。`;
}

function renderFallback(risks, suggestionItems, level, score) {
  riskBanner.dataset.level = level;
  riskBanner.querySelector(".risk-label").textContent = level === "pending" ? "等待分析" : "提示";
  riskScore.textContent = `${score}分`;
  shapeMetric.textContent = "-";
  colorMetric.textContent = "-";
  edgeMetric.textContent = "-";
  overallMetric.textContent = "-";
  reviewAdvice.textContent = "待分析";
  usageAdvice.textContent = "待分析";
  riskPoints.innerHTML = risks.map((item) => `<li>${item}</li>`).join("");
  suggestions.innerHTML = suggestionItems.map((item) => `<li>${item}</li>`).join("");
}

function setBackendStatus(text, type) {
  backendStatus.textContent = text;
  backendStatus.className = `status-card${type ? ` ${type}` : ""}`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function exportReport(result) {
  const content = [
    "图像侵权风险分析报告",
    `分析时间：${result.analyzedAt}`,
    `设计图：${result.designFile}`,
    `对比图：${result.referenceFile}`,
    "",
    "一、风险结论",
    `风险等级：${result.evaluation.label}`,
    `风险评分：${result.evaluation.score}分`,
    `审核建议：${result.evaluation.reviewAdviceText}`,
    `使用建议：${result.evaluation.usageAdviceText}`,
    "",
    "二、图像相似度维度",
    `配色接近度：${formatPercent(result.metrics.colorSimilarity)}`,
    `构图接近度：${formatPercent(result.metrics.compositionSimilarity)}`,
    `画法接近度：${formatPercent(result.metrics.edgeSimilarity)}`,
    `整体视觉接近度：${formatPercent(result.metrics.overallSimilarity)}`,
    `规则摘要：${result.evaluation.differenceSummary}`,
    "",
    "三、自动识别结果",
    `后端模型：${result.assessment.model}`,
    `图案类型：${translatePatternType(result.assessment.patternType)}`,
    `品牌/IP风险：${result.assessment.brandRisk === "yes" ? "是" : "否"}`,
    `识别到的品牌/IP：${result.assessment.brandOrIpNames.join("、") || "无"}`,
    `AI是否保留原轮廓：${result.assessment.aiOutlineRisk === "yes" ? "是" : "否"}`,
    `元素差异比例：${translateElementDifference(result.assessment.elementDifferenceLevel)}`,
    `视觉印象差异：${result.assessment.visualDifference === "yes" ? "不同" : "接近"}`,
    `主要元素差异：${result.assessment.mainElementDifferent === "yes" ? "不同" : "未明显不同"}`,
    `识别摘要：${result.assessment.summary || "无"}`,
    `补充说明：${result.notes || "无"}`,
    "",
    "四、风险关注点",
    ...result.evaluation.riskPoints.map((item, index) => `${index + 1}. ${item}`),
    "",
    "五、修改建议",
    ...result.evaluation.suggestions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "六、说明",
    "本结果基于图像特征和后端自动识别进行初筛，不构成正式法律意见。",
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `图像侵权分析报告-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function translatePatternType(value) {
  return value === "composite" ? "组合图案" : "单一图案";
}

function translateElementDifference(value) {
  return value === "ge50" ? "50%及以上不同" : "低于50%不同";
}
