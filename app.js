const designInput = document.getElementById("designInput");
const referenceInput = document.getElementById("referenceInput");
const analyzeButton = document.getElementById("analyzeButton");
const exportButton = document.getElementById("exportButton");

const designPreview = document.getElementById("designPreview");
const referencePreview = document.getElementById("referencePreview");
const designHint = document.getElementById("designHint");
const referenceHint = document.getElementById("referenceHint");

const patternType = document.getElementById("patternType");
const brandRisk = document.getElementById("brandRisk");
const elementDifferenceLevel = document.getElementById("elementDifferenceLevel");
const visualDifference = document.getElementById("visualDifference");
const mainElementDifferent = document.getElementById("mainElementDifferent");
const aiOutlineRisk = document.getElementById("aiOutlineRisk");
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
  strongSimilarity: 0.88,
  closeToBoundary: 0.05,
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
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "分析中...";

  try {
    const metrics = await compareImages(state.designImage, state.referenceImage);
    const inputs = {
      patternType: patternType.value,
      brandRisk: brandRisk.value,
      elementDifferenceLevel: elementDifferenceLevel.value,
      visualDifference: visualDifference.value,
      mainElementDifferent: mainElementDifferent.value,
      aiOutlineRisk: aiOutlineRisk.value,
      notes: notesInput.value.trim(),
      designFile: designHint.textContent,
      referenceFile: referenceHint.textContent,
    };

    const evaluation = evaluateRisk(metrics, inputs);
    state.lastResult = {
      analyzedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      inputs,
      metrics,
      evaluation,
    };

    renderResult(metrics, evaluation);
  } catch (error) {
    renderFallback(
      ["图片分析失败，可能是文件损坏或浏览器不支持。"],
      ["请尝试更换图片格式，或压缩后再次上传。"],
      "pending",
      0
    );
    analysisSummary.textContent = `错误信息：${error.message}`;
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "开始分析";
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
    shapeSimilarity,
    sizeRatio,
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

function evaluateRisk(metrics, inputs) {
  const riskPointsList = [];
  const suggestionList = [];

  const colorDifferent = metrics.colorSimilarity < THRESHOLDS.colorDifferentMax;
  const compositionDifferent = metrics.compositionSimilarity < THRESHOLDS.compositionDifferentMax;
  const styleDifferent = metrics.edgeSimilarity < THRESHOLDS.styleDifferentMax;
  const differentCount = [colorDifferent, compositionDifferent, styleDifferent]
    .filter(Boolean)
    .length;

  if (inputs.brandRisk === "yes") {
    riskPointsList.push("已标记含知名品牌或IP元素，按规则直接判定为高风险。");
    suggestionList.push("删除品牌/IP相关元素，替换为原创主体和原创细节后再重新评估。");
    return buildResult({
      score: 98,
      level: "high",
      riskPointsList,
      suggestionList,
      differentCount,
      colorDifferent,
      compositionDifferent,
      styleDifferent,
    });
  }

  if (inputs.aiOutlineRisk === "yes") {
    riskPointsList.push("已标记AI保留原轮廓，按规则直接判定为高风险。");
    suggestionList.push("不要沿用原图轮廓重绘，建议重做主体外轮廓和整体画面逻辑。");
    return buildResult({
      score: 96,
      level: "high",
      riskPointsList,
      suggestionList,
      differentCount,
      colorDifferent,
      compositionDifferent,
      styleDifferent,
    });
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
    overallLevel = "low";
    riskPointsList.push("配色、构图、画法三项均不同，按规则属于低风险。");
  }

  let patternLevel = "low";
  if (inputs.patternType === "single") {
    if (inputs.mainElementDifferent === "no" && inputs.visualDifference === "no") {
      patternLevel = "high";
      riskPointsList.push("单一图案中主体没变且视觉接近，按规则属于高风险。");
      suggestionList.push("更换主要图案元素，或显著调整主体轮廓、动作、表情和关键细节。");
    } else if (inputs.mainElementDifferent === "no" && inputs.visualDifference === "yes") {
      patternLevel = "medium";
      riskPointsList.push("单一图案中主体没变但视觉不同，按规则属于中风险。");
      suggestionList.push("虽然视觉有所调整，但建议继续拉开主体差异，避免停留在同一主体的小改。");
    } else if (inputs.mainElementDifferent === "yes" && inputs.visualDifference === "yes") {
      patternLevel = "low";
      riskPointsList.push("单一图案中主体已变化且视觉不同，按规则属于低风险。");
    } else {
      patternLevel = "medium";
      riskPointsList.push("单一图案中主体已变化，但视觉印象仍较接近，按规则从严归为中风险。");
      suggestionList.push("主体虽然已换，但还应继续调整风格或构图，拉开整体视觉印象。");
    }
  } else {
    if (inputs.elementDifferenceLevel === "lt50") {
      patternLevel = "high";
      riskPointsList.push("组合图案的元素差异比例低于50%，按规则属于高风险。");
      suggestionList.push("增加新元素或替换原有元素组合，确保整体组成元素至少50%不同。");
    } else if (inputs.visualDifference === "no") {
      patternLevel = "medium";
      riskPointsList.push("组合图案元素差异已达到50%以上，但视觉印象仍接近，按规则属于中风险。");
      suggestionList.push("进一步重做相同元素的轮廓、比例、姿态或表现方式，拉开视觉印象。");
    } else {
      patternLevel = "low";
      riskPointsList.push("组合图案元素差异达到50%以上，且视觉印象不同，按规则属于低风险。");
    }
  }

  if (inputs.notes.includes("参考") || inputs.notes.includes("借鉴")) {
    suggestionList.push("既然存在参考关系，建议保留草图和修改过程，便于后续人工复核。");
  }

  if (suggestionList.length === 0) {
    suggestionList.push("继续保持配色、构图和画法上的差异，并保留创作过程记录。");
  }

  const level = highestLevel(overallLevel, patternLevel);
  const score = scoreFromLevel(level, metrics.overallSimilarity);

  return buildResult({
    score,
    level,
    riskPointsList,
    suggestionList,
    differentCount,
    colorDifferent,
    compositionDifferent,
    styleDifferent,
  });
}

function buildResult({
  score,
  level,
  riskPointsList,
  suggestionList,
  differentCount,
  colorDifferent,
  compositionDifferent,
  styleDifferent,
}) {
  const label =
    level === "high" ? "高风险" :
    level === "medium" ? "中风险" :
    "低风险";

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

function uniqueList(items) {
  return [...new Set(items)];
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

function renderResult(metrics, evaluation) {
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
    ` 当前系统将颜色直方图近似为配色接近度，将结构与画幅比例近似为构图接近度，将边缘组织近似为画法接近度。` +
    ` 整体视觉接近度为 ${formatPercent(metrics.overallSimilarity)}。`;
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
  analysisSummary.textContent =
    "系统会根据配色、构图、画法三项整体视觉印象，以及单一/组合图案元素规则进行判定。";
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function exportReport(result) {
  const content = [
    "图像侵权风险分析报告",
    `分析时间：${result.analyzedAt}`,
    `设计图：${result.inputs.designFile}`,
    `对比图：${result.inputs.referenceFile}`,
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
    "三、人工补充项",
    `图案类型：${translatePatternType(result.inputs.patternType)}`,
    `是否含知名品牌/IP元素：${result.inputs.brandRisk === "yes" ? "是" : "否"}`,
    `AI是否保留原轮廓：${result.inputs.aiOutlineRisk === "yes" ? "是" : "否"}`,
    `元素差异比例：${translateElementDifference(result.inputs.elementDifferenceLevel)}`,
    `相同元素视觉印象是否不同：${result.inputs.visualDifference === "yes" ? "是" : "否"}`,
    `主要图案元素是否不同：${result.inputs.mainElementDifferent === "yes" ? "是" : "否"}`,
    `补充说明：${result.inputs.notes || "无"}`,
    "",
    "四、风险关注点",
    ...result.evaluation.riskPoints.map((item, index) => `${index + 1}. ${item}`),
    "",
    "五、修改建议",
    ...result.evaluation.suggestions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "六、说明",
    "本结果基于配色、构图、画法及单一/组合图案元素规则进行初筛，不构成正式法律意见。",
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
