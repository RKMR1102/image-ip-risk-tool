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
const riskCategories = document.getElementById("riskCategories");
const reviewReasons = document.getElementById("reviewReasons");
const protectableExpression = document.getElementById("protectableExpression");
const commonElements = document.getElementById("commonElements");
const similarityEvidence = document.getElementById("similarityEvidence");
const differences = document.getElementById("differences");
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
    state.lastResult = {
      analyzedAt: comparison.analyzedAt,
      notes: notesInput.value.trim(),
      designFile: designHint.textContent,
      referenceFile: "Google 搜图结果",
      response: comparison,
    };
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
    const missing = [
      !state.designProfile ? "设计图" : "",
      !state.referenceProfile ? "指定对比图" : "",
    ].filter(Boolean).join("、");
    renderFallback(
      [`还缺少：${missing}。`],
      ["请补齐两张图片后再开始自动比对。"]
    );
    window.alert(`请先上传${missing}。`);
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
  const textSignals = detectTextRiskSignals(notes);
  const subjectChanged = looksSubjectIdentityChanged(similarity);
  const evidence = buildRuleEvidence(similarity, patternType, textSignals);
  const scoreParts = calculateRuleScore(similarity, textSignals, patternType);
  let score = scoreParts.score;
  let level = scoreToLevel(score);
  const escalationReasons = [];
  const majorDifferences = getMajorDifferenceCount(similarity);

  if (similarity.overallSimilarity >= 0.9 && similarity.subjectSimilarity >= 0.86 && majorDifferences === 0) {
    score = Math.max(score, 85);
    level = "high";
    escalationReasons.push("整体、主体和细节均达到近重复阈值，触发疑似直接复制升级。");
  } else if (
    similarity.maskSimilarity >= 0.93 &&
    similarity.edgeSimilarity >= 0.86 &&
    similarity.subjectSimilarity >= 0.78 &&
    similarity.compositionSimilarity >= 0.72 &&
    similarity.visualSimilarity >= 0.7 &&
    majorDifferences === 0
  ) {
    score = Math.max(score, 70);
    level = scoreToLevel(score);
    escalationReasons.push("主体、构图、细节和轮廓均保持高度对应，触发强制人工复核规则。");
  } else if (majorDifferences >= 2) {
    score = Math.min(score, 29);
    level = "low";
    escalationReasons.push("主体、构图或细节至少两项明显不同，按明显差异规则封顶为低风险。");
  } else if (majorDifferences === 1 && score >= 70) {
    score = 69;
    level = "low";
    escalationReasons.push("存在一项核心维度明显不同，风险分数封顶为低风险，避免单一指标误报高风险；仍建议人工复核。");
  }
  if (textSignals.protected) {
    if (majorDifferences === 0) {
      score = Math.max(score, 70);
      level = scoreToLevel(score);
    } else {
      score = Math.min(score, 69);
      level = "low";
    }
    escalationReasons.push("补充说明包含商标、品牌、赛事或明确 IP 线索；即使图片差异明显，也必须人工核验权属和来源，但不会仅凭文字把视觉风险强行判高。");
  }
  if (textSignals.directCopy) {
    if (majorDifferences === 0) {
      score = Math.max(score, 70);
      level = scoreToLevel(score);
    } else {
      score = Math.min(score, 69);
      level = "low";
    }
    escalationReasons.push("补充说明包含直接复制或换色/镜像/裁剪线索，不能按低风险放行。");
  }
  if (textSignals.license) escalationReasons.push("检测到授权或图库许可线索；仍需核验许可类型、购买记录和使用范围。");

  const reasons = [
    `按“构图25%、核心图案20%、组合关系20%、局部细节15%、色彩10%、文字/标识10%”模型计算，原始评分 ${scoreParts.rawScore} 分。`,
    `公共/惯用元素修正 ${scoreParts.publicPenalty} 分，独创性修正 ${scoreParts.originalityAdjustment >= 0 ? "+" : ""}${scoreParts.originalityAdjustment} 分，明显差异修正 ${scoreParts.divergencePenalty || 0} 分，最终评分 ${score} 分。`,
    `当前按${patternType === "composite" ? "组合" : "单一"}图案处理；主题相同本身不作为侵权结论，重点观察具体表达和元素关系。`,
    ...escalationReasons,
    `视觉代理指标：主体 ${formatPercent(similarity.subjectSimilarity)}，构图 ${formatPercent(similarity.compositionSimilarity)}，细节 ${formatPercent(similarity.visualSimilarity)}，色彩 ${formatPercent(similarity.colorSimilarity)}。`,
  ];
  const categories = buildRiskCategories(scoreParts, similarity, textSignals);
  const reviewItems = buildReviewReasons(score, textSignals, evidence);
  const protectable = buildProtectableExpression(similarity, patternType, textSignals);
  const common = buildCommonElements(similarity, textSignals);

  const result = {
    analyzedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    referenceResult: similarity,
    topMatches: [],
    evaluation: {
      level,
      label: levelToLabel(level),
      score,
      confidence: calculateConfidence(similarity),
      reviewAdviceText:
        level === "high" ? "建议立即人工复核并暂停使用" : level === "medium" ? "建议补充权属材料并人工复核" : (majorDifferences > 0 || textSignals.protected || textSignals.directCopy ? "图片差异明显，但仍建议核验来源和权属" : "可进入人工抽检流程"),
      usageAdviceText:
        level === "high" ? "不建议直接使用" : level === "medium" ? "修改完成后再评估是否可用" : "建议保留记录后谨慎使用",
      riskPoints: buildRiskPoints(similarity),
      suggestions: buildSuggestions(level, patternType, subjectChanged),
      copyrightRisk: categories.copyright,
      trademarkRisk: categories.trademark,
      reviewRequired: level !== "low" || majorDifferences > 0 || textSignals.protected || textSignals.directCopy,
      directCopySuspected: score >= 85 && majorDifferences === 0,
      protectableExpression: protectable,
      commonElements: common,
      similarityEvidence: evidence.similarity,
      differences: evidence.differences,
      reviewReasons: reviewItems,
      riskCategories: categories.items,
      reasons,
      summary: `本次执行“设计图 vs 指定对比图”分析，评分 ${score} 分，给出${levelToLabel(level)}结论。系统已区分具体表达与公共题材，并将版权风险、商标/IP风险分开提示；自动判断仅作初筛，不能替代律师或司法认定。`,
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

function calculateRuleScore(similarity, textSignals, patternType) {
  const composition = similarity.compositionSimilarity;
  const subject = similarity.subjectSimilarity;
  const combination = (similarity.compositionSimilarity + similarity.blockSimilarity) / 2;
  const detail = (similarity.visualSimilarity + similarity.edgeSimilarity + similarity.maskSimilarity) / 3;
  const color = similarity.colorSimilarity;
  const text = textSignals.protected ? 0.85 : textSignals.directCopy ? 0.72 : 0;
  const rawScore = Math.round(
    composition * 25 + subject * 20 + combination * 20 + detail * 15 + color * 10 + text * 10
  );

  // 纯像素特征无法识别具体物体，因此用“低复杂度/常见风格”作保守代理，
  // 并把补充说明中的公共题材作为明确的降权信号。它不会把强复制证据抹掉。
  const publicPenalty = Math.round(
    (textSignals.common ? 8 : 0) + (patternType === "single" && subject < 0.72 ? 3 : 0)
  );
  const originalityAdjustment = Math.round(
    (patternType === "composite" && combination >= 0.68 ? 6 : 0) +
    (detail >= 0.8 && subject >= 0.72 ? 5 : 0) -
    (textSignals.common ? 4 : 0)
  );
  const majorDifferences = getMajorDifferenceCount(similarity);
  const divergencePenalty = majorDifferences * 14;
  const score = Math.max(0, Math.min(100, rawScore - publicPenalty + originalityAdjustment - divergencePenalty));
  return { rawScore, publicPenalty, originalityAdjustment, divergencePenalty, score };
}

function getMajorDifferenceCount(similarity) {
  return [
    similarity.subjectSimilarity < 0.5,
    similarity.compositionSimilarity < 0.45,
    similarity.visualSimilarity < 0.45,
  ].filter(Boolean).length;
}

function scoreToLevel(score) {
  if (score > 80) return "high";
  if (score >= 70) return "medium";
  return "low";
}

function buildRuleEvidence(similarity, patternType, textSignals) {
  const similarityItems = [];
  const differences = [];
  if (similarity.compositionSimilarity >= 0.62) similarityItems.push("视觉中心、位置比例或留白关系存在对应。");
  if (similarity.subjectSimilarity >= 0.62) similarityItems.push("主体轮廓、姿态或核心识别关系接近。");
  if (patternType === "composite" && similarity.blockSimilarity >= 0.62) similarityItems.push("多个元素的数量/排列区域呈现相似组合关系。");
  if (similarity.visualSimilarity >= 0.62) similarityItems.push("线条、局部细节、明暗或整体视觉表达存在对应。");
  if (similarity.colorSimilarity >= 0.7) similarityItems.push("主要色彩及色块分布较接近（仅作辅助证据）。");
  if (similarity.compositionSimilarity < 0.62) differences.push("整体构图或视觉重心有明显变化。");
  if (similarity.subjectSimilarity < 0.62) differences.push("主体轮廓、姿态或比例差异明显。");
  if (similarity.visualSimilarity < 0.62) differences.push("线条、纹理和局部细节差异明显。");
  if (similarity.colorSimilarity < 0.7) differences.push("色彩或明暗分布不同，但色彩不能单独决定侵权。");
  if (textSignals.common) differences.push("补充说明包含常见题材/公共元素，应降低其单独证明力。");
  if (!similarityItems.length) similarityItems.push("未发现足够强的具体表达对应，仍建议结合来源人工复核。");
  if (!differences.length) differences.push("当前代理指标未发现明显差异；需要核验创作来源和权属材料。");
  return { similarity: similarityItems, differences };
}

function buildRiskCategories(parts, similarity, textSignals) {
  const copyrightScore = Math.round(
    similarity.compositionSimilarity * 30 + similarity.subjectSimilarity * 25 +
    ((similarity.blockSimilarity + similarity.visualSimilarity) / 2) * 30 + similarity.colorSimilarity * 5 +
    (textSignals.directCopy ? 10 : 0)
  );
  const trademarkScore = Math.round(
    (textSignals.protected ? 65 : 0) + (textSignals.directCopy ? 20 : 0) +
    similarity.subjectSimilarity * 10 + similarity.compositionSimilarity * 5
  );
  return {
    copyright: scoreToCategory(copyrightScore),
    trademark: scoreToCategory(trademarkScore),
    items: [`版权风险：${scoreToCategory(copyrightScore)}（具体表达、构图、主体与组合关系）`, `商标/IP风险：${scoreToCategory(trademarkScore)}（文字、标识、品牌和来源混淆线索）`],
  };
}

function scoreToCategory(score) {
  if (score >= 70) return "高";
  if (score >= 50) return "中";
  return "低";
}

function buildReviewReasons(score, textSignals, evidence) {
  const items = [];
  if (score >= 30) items.push("评分达到需要复核区间，不能仅凭自动分数作最终结论。");
  if (textSignals.protected) items.push("涉及品牌、商标、赛事、影视角色或明确 IP 线索。");
  if (textSignals.directCopy) items.push("存在复制、换色、镜像、裁剪或局部替换的描述线索。");
  if (evidence.similarity.length >= 3) items.push("至少三个具体表达维度出现对应，需要核验接触可能和创作时间。");
  if (!items.length) items.push("暂未触发强制升级；仍建议保存来源、授权和创作过程记录。");
  return items;
}

function buildProtectableExpression(similarity, patternType, textSignals) {
  const items = [];
  if (similarity.subjectSimilarity >= 0.62) items.push("主体轮廓、比例、姿态及核心造型");
  if (similarity.compositionSimilarity >= 0.62) items.push("视觉中心、构图布局、层次和留白关系");
  if (patternType === "composite" && similarity.blockSimilarity >= 0.62) items.push("多个元素的选择、排列及相互遮挡关系");
  if (similarity.visualSimilarity >= 0.62) items.push("线条、纹理、阴影和局部装饰的组合");
  if (textSignals.protected) items.push("补充说明涉及的文字、标志或品牌识别元素（需核验权利）");
  return items.length ? items : ["暂未发现足够明确的独创性表达对应"];
}

function buildCommonElements(similarity, textSignals) {
  const items = [];
  if (textSignals.common) items.push("补充说明提到的常见题材、公共领域素材或行业惯用元素");
  if (similarity.colorSimilarity >= 0.7) items.push("相近配色、渐变、明暗关系（不能单独认定侵权）");
  if (!items.length) items.push("目前未从图片特征中识别出明确公共元素；常见对象仍需人工区分题材与具体表达");
  return items;
}

function detectTextRiskSignals(notes) {
  const text = String(notes || "").toLowerCase();
  return {
    protected: /(商标|注册|品牌|赛事|ip|版权|影视|角色|logo|trademark|disney|nike|nba|nfl)/i.test(text),
    directCopy: /(一样|一模一样|几乎一样|原图|不改|无需修改|保持不变|看不出来哪里改|直接使用)/i.test(text),
    license: /(授权|许可|增强版|购买|shutterstock|license|licensed)/i.test(text),
    common: /(猫|狗|花|月亮|星星|山水|宇宙|几何|渐变|复古|梦幻|极简|国潮|科技感|公共素材|通用元素)/i.test(text),
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
    return Math.min(100, Math.max(80, base));
  }
  if (level === "medium") {
    return Math.min(79, Math.max(70, base));
  }
  return Math.min(base, 69);
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
  renderList(riskCategories, evaluation.riskCategories);
  renderList(reviewReasons, evaluation.reviewReasons);
  renderList(protectableExpression, evaluation.protectableExpression);
  renderList(commonElements, evaluation.commonElements);
  renderList(similarityEvidence, evaluation.similarityEvidence);
  renderList(differences, evaluation.differences);

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
  renderList(riskCategories, ["等待分析结果。"]);
  renderList(reviewReasons, ["等待分析结果。"]);
  renderList(protectableExpression, ["等待分析结果。"]);
  renderList(commonElements, ["等待分析结果。"]);
  renderList(similarityEvidence, ["等待分析结果。"]);
  renderList(differences, ["等待分析结果。"]);
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
    `自动判断置信度：${response.evaluation.confidence}%（仅作初筛）`,
    `版权风险：${response.evaluation.copyrightRisk}`,
    `商标/IP风险：${response.evaluation.trademarkRisk}`,
    `需要人工复核：${response.evaluation.reviewRequired ? "是" : "否"}`,
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
    "五、可保护表达",
    ...response.evaluation.protectableExpression.map((item, index) => `${index + 1}. ${item}`),
    "",
    "六、公共或弱保护元素",
    ...response.evaluation.commonElements.map((item, index) => `${index + 1}. ${item}`),
    "",
    "七、相似证据",
    ...response.evaluation.similarityEvidence.map((item, index) => `${index + 1}. ${item}`),
    "",
    "八、主要差异",
    ...response.evaluation.differences.map((item, index) => `${index + 1}. ${item}`),
    "",
    "九、需人工复核",
    ...response.evaluation.reviewReasons.map((item, index) => `${index + 1}. ${item}`),
    "",
    "十、修改建议",
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

function renderList(element, items) {
  if (!element) return;
  element.innerHTML = (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
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
