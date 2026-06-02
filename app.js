const designInput = document.getElementById("designInput");
const referenceInput = document.getElementById("referenceInput");
const analyzeButton = document.getElementById("analyzeButton");
const exportButton = document.getElementById("exportButton");

const designPreview = document.getElementById("designPreview");
const referencePreview = document.getElementById("referencePreview");
const designHint = document.getElementById("designHint");
const referenceHint = document.getElementById("referenceHint");

const elementOverlap = document.getElementById("elementOverlap");
const styleOverlap = document.getElementById("styleOverlap");
const tracingRisk = document.getElementById("tracingRisk");
const commercialUsage = document.getElementById("commercialUsage");
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
      elementOverlap: elementOverlap.value,
      styleOverlap: styleOverlap.value,
      tracingRisk: tracingRisk.value,
      commercialUsage: commercialUsage.value,
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

  const overallSimilarity = (
    shapeSimilarity * 0.4 +
    edgeSimilarity * 0.35 +
    colorSimilarity * 0.25
  );

  return {
    shapeSimilarity,
    edgeSimilarity,
    colorSimilarity,
    overallSimilarity,
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
  let score = 0;
  const riskPointsList = [];
  const suggestionList = [];

  score += metrics.overallSimilarity * 45;
  score += metrics.shapeSimilarity * 25;
  score += metrics.edgeSimilarity * 15;
  score += metrics.colorSimilarity * 10;

  if (metrics.overallSimilarity > 0.82) {
    riskPointsList.push("两张图片整体视觉接近度较高，容易形成可替代印象。");
    suggestionList.push("优先重做主体构图，调整主体位置关系、朝向和主要留白。");
  }

  if (metrics.shapeSimilarity > 0.86) {
    score += 10;
    riskPointsList.push("主体轮廓与构图形态高度接近，存在过度参考或临摹风险。");
    suggestionList.push("修改主体外轮廓和关键比例，尤其是易被识别的轮廓节奏。");
  }

  if (metrics.edgeSimilarity > 0.84) {
    score += 8;
    riskPointsList.push("关键边缘走向接近，说明线条组织和细节结构相似。");
    suggestionList.push("更换线条粗细、纹理组织和局部细节处理方式。");
  }

  if (metrics.colorSimilarity > 0.88) {
    score += 6;
    riskPointsList.push("主色和辅色分布高度相似，会强化整体近似印象。");
    suggestionList.push("替换主辅色关系，拉开明度层次并重设视觉重心。");
  }

  if (metrics.sizeRatio > 0.95) {
    score += 4;
    riskPointsList.push("画幅比例非常接近，构图借鉴痕迹更明显。");
    suggestionList.push("改变裁切方式或版式比例，重新组织主体与背景关系。");
  }

  if (inputs.elementOverlap === "medium") {
    score += 8;
    riskPointsList.push("人工判断核心元素存在中等重合，需要重点核查标志性对象。");
  } else if (inputs.elementOverlap === "high") {
    score += 16;
    riskPointsList.push("人工判断核心元素重合较高，容易触发侵权争议。");
    suggestionList.push("替换核心元素组合，不只改细节，还要改题材关系和动作叙事。");
  }

  if (inputs.styleOverlap === "medium") {
    score += 5;
  } else if (inputs.styleOverlap === "high") {
    score += 10;
    riskPointsList.push("整体表现风格过于接近，可能构成视觉表达近似。");
    suggestionList.push("更换笔触系统、纹理语言或平涂与描边方案。");
  }

  if (inputs.tracingRisk === "suspected") {
    score += 12;
    riskPointsList.push("存在描摹嫌疑，建议回看草图和分层文件。");
    suggestionList.push("保留草图、分层文件和重绘过程，证明独立创作路径。");
  } else if (inputs.tracingRisk === "yes") {
    score += 28;
    riskPointsList.push("已确认存在直接描摹或沿轮廓改图，属于高风险行为。");
    suggestionList.push("建议直接废弃当前版本，重新独立创作，不要在原轮廓上微调。");
  }

  if (inputs.commercialUsage === "campaign") {
    score += 6;
  } else if (inputs.commercialUsage === "product") {
    score += 12;
    riskPointsList.push("素材将用于商品销售，商业化场景会放大侵权后果。");
  }

  if (inputs.notes.includes("借鉴") || inputs.notes.includes("参考")) {
    suggestionList.push("如果确实参考了他作，请记录参考边界，并确认未复制可识别表达。");
  }

  score = Math.min(100, Math.round(score));

  let level = "low";
  let label = "低风险";

  if (score >= 75) {
    level = "high";
    label = "高风险";
  } else if (score >= 45) {
    level = "medium";
    label = "中风险";
  }

  if (riskPointsList.length === 0) {
    riskPointsList.push("当前自动指标未发现明显高重合特征，但仍建议人工复核标志性元素。");
  }

  if (suggestionList.length === 0) {
    suggestionList.push("继续拉开主体形态、配色和场景关系，并保留创作过程记录。");
  }

  const reviewAdviceText =
    level === "high"
      ? "建议立即转法务复核"
      : level === "medium"
        ? "建议设计主管复核后再投放"
        : "可进入人工抽检流程";

  const usageAdviceText =
    level === "high"
      ? "不建议直接商用"
      : level === "medium"
        ? "修改后再评估是否商用"
        : "保留过程文件后可谨慎使用";

  return {
    score,
    level,
    label,
    reviewAdviceText,
    usageAdviceText,
    riskPoints: uniqueList(riskPointsList),
    suggestions: uniqueList(suggestionList),
  };
}

function uniqueList(items) {
  return [...new Set(items)];
}

function renderResult(metrics, evaluation) {
  riskBanner.dataset.level = evaluation.level;
  riskBanner.querySelector(".risk-label").textContent = evaluation.label;
  riskScore.textContent = `${evaluation.score}分`;

  shapeMetric.textContent = formatPercent(metrics.shapeSimilarity);
  colorMetric.textContent = formatPercent(metrics.colorSimilarity);
  edgeMetric.textContent = formatPercent(metrics.edgeSimilarity);
  overallMetric.textContent = formatPercent(metrics.overallSimilarity);
  reviewAdvice.textContent = evaluation.reviewAdviceText;
  usageAdvice.textContent = evaluation.usageAdviceText;

  riskPoints.innerHTML = evaluation.riskPoints.map((item) => `<li>${item}</li>`).join("");
  suggestions.innerHTML = evaluation.suggestions.map((item) => `<li>${item}</li>`).join("");

  analysisSummary.textContent =
    `综合接近度 ${formatPercent(metrics.overallSimilarity)}，` +
    `结构相似度 ${formatPercent(metrics.shapeSimilarity)}，` +
    `边缘相似度 ${formatPercent(metrics.edgeSimilarity)}，` +
    `颜色相似度 ${formatPercent(metrics.colorSimilarity)}。` +
    " 该结果适合作为设计初筛，正式上线前建议补充人工复核、白名单图库校验和法务审批。";
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
    "二、相似度指标",
    `结构相似度：${formatPercent(result.metrics.shapeSimilarity)}`,
    `颜色相似度：${formatPercent(result.metrics.colorSimilarity)}`,
    `边缘相似度：${formatPercent(result.metrics.edgeSimilarity)}`,
    `综合接近度：${formatPercent(result.metrics.overallSimilarity)}`,
    "",
    "三、人工补充项",
    `核心元素重合度：${translateOption(result.inputs.elementOverlap)}`,
    `表现风格重合度：${translateOption(result.inputs.styleOverlap)}`,
    `是否存在描摹：${translateTracing(result.inputs.tracingRisk)}`,
    `用途场景：${translateUsage(result.inputs.commercialUsage)}`,
    `补充说明：${result.inputs.notes || "无"}`,
    "",
    "四、风险关注点",
    ...result.evaluation.riskPoints.map((item, index) => `${index + 1}. ${item}`),
    "",
    "五、修改建议",
    ...result.evaluation.suggestions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "六、说明",
    "本结果为规则引擎初筛结论，不构成正式法律意见。建议对中高风险结果执行人工复核与法务复审。",
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `图像侵权分析报告-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function translateOption(value) {
  if (value === "high") {
    return "高";
  }
  if (value === "medium") {
    return "中";
  }
  return "低";
}

function translateTracing(value) {
  if (value === "yes") {
    return "是";
  }
  if (value === "suspected") {
    return "疑似";
  }
  return "否";
}

function translateUsage(value) {
  if (value === "product") {
    return "商品销售";
  }
  if (value === "campaign") {
    return "商业推广";
  }
  return "内部测试/学习";
}
