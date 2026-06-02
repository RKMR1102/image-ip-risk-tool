const STORAGE_KEY = "image-ip-risk-library-v4";
const THRESHOLD_STORAGE_KEY = "image-ip-risk-thresholds-v3";
const MATCH_LIMIT = 5;
const DEFAULT_THRESHOLDS = { high: 86, medium: 72 };
const BRAND_IP_KEYWORDS = [
  "brand",
  "ip",
  "品牌",
  "角色",
  "影视",
  "动漫",
  "动画",
  "卡通",
  "联名",
  "迪士尼",
  "迪斯尼",
  "disney",
  "sanrio",
  "hello kitty",
  "kitty",
  "mickey",
  "minnie",
  "marvel",
  "dc",
  "pokemon",
  "宝可梦",
  "皮卡丘",
  "line friends",
  "哆啦a梦",
  "小猪佩奇",
  "史努比",
  "米奇",
  "米妮",
];

const designInput = document.getElementById("designInput");
const referenceInput = document.getElementById("referenceInput");
const analyzeButton = document.getElementById("analyzeButton");
const exportButton = document.getElementById("exportButton");

const designPreview = document.getElementById("designPreview");
const referencePreview = document.getElementById("referencePreview");
const designHint = document.getElementById("designHint");
const referenceHint = document.getElementById("referenceHint");
const notesInput = document.getElementById("notesInput");

const libraryNameInput = document.getElementById("libraryNameInput");
const libraryCategoryInput = document.getElementById("libraryCategoryInput");
const libraryNotesInput = document.getElementById("libraryNotesInput");
const libraryFilesInput = document.getElementById("libraryFilesInput");
const libraryTagsInput = document.getElementById("libraryTagsInput");
const batchLibraryInput = document.getElementById("batchLibraryInput");
const addLibraryButton = document.getElementById("addLibraryButton");
const exportLibraryButton = document.getElementById("exportLibraryButton");
const importLibraryInput = document.getElementById("importLibraryInput");
const clearLibraryButton = document.getElementById("clearLibraryButton");
const libraryStatus = document.getElementById("libraryStatus");
const libraryGrid = document.getElementById("libraryGrid");
const librarySearchInput = document.getElementById("librarySearchInput");
const libraryCategoryFilter = document.getElementById("libraryCategoryFilter");
const libraryTagFilter = document.getElementById("libraryTagFilter");

const riskBanner = document.getElementById("riskBanner");
const riskScore = document.getElementById("riskScore");
const shapeMetric = document.getElementById("shapeMetric");
const colorMetric = document.getElementById("colorMetric");
const edgeMetric = document.getElementById("edgeMetric");
const overallMetric = document.getElementById("overallMetric");
const highThresholdInput = document.getElementById("highThresholdInput");
const mediumThresholdInput = document.getElementById("mediumThresholdInput");
const highThresholdValue = document.getElementById("highThresholdValue");
const mediumThresholdValue = document.getElementById("mediumThresholdValue");
const reviewAdvice = document.getElementById("reviewAdvice");
const usageAdvice = document.getElementById("usageAdvice");
const libraryMatches = document.getElementById("libraryMatches");
const referenceSummary = document.getElementById("referenceSummary");
const compareDesignPreview = document.getElementById("compareDesignPreview");
const compareMatchPreview = document.getElementById("compareMatchPreview");
const compareMatchLabel = document.getElementById("compareMatchLabel");
const ruleReasons = document.getElementById("ruleReasons");
const riskPoints = document.getElementById("riskPoints");
const suggestions = document.getElementById("suggestions");
const analysisSummary = document.getElementById("analysisSummary");

const state = {
  designImage: null,
  designDataUrl: "",
  referenceImage: null,
  referenceDataUrl: "",
  riskLibrary: loadRiskLibrary(),
  thresholds: loadThresholds(),
  filters: {
    search: "",
    category: "",
    tag: "",
  },
  lastResult: null,
};

designInput.addEventListener("change", (event) => {
  handleImageSelection(event.target.files?.[0], "design");
});

referenceInput.addEventListener("change", (event) => {
  handleImageSelection(event.target.files?.[0], "reference");
});

addLibraryButton.addEventListener("click", addLibraryEntry);
batchLibraryInput.addEventListener("change", importLibraryFolder);
exportLibraryButton.addEventListener("click", exportRiskLibrary);
importLibraryInput.addEventListener("change", importRiskLibrary);
clearLibraryButton.addEventListener("click", clearRiskLibrary);
highThresholdInput.addEventListener("input", handleThresholdInput);
mediumThresholdInput.addEventListener("input", handleThresholdInput);
librarySearchInput.addEventListener("input", handleLibraryFilterChange);
libraryCategoryFilter.addEventListener("change", handleLibraryFilterChange);
libraryTagFilter.addEventListener("change", handleLibraryFilterChange);

analyzeButton.addEventListener("click", handleAnalyze);
exportButton.addEventListener("click", () => {
  if (!state.lastResult) {
    renderFallback(
      ["当前还没有可导出的分析结果。"],
      ["请先完成一次自动比对，再导出报告。"],
      "pending",
      0
    );
    return;
  }

  exportReport(state.lastResult);
});

renderLibrary();
syncThresholdControls();
renderComparePreview();

async function handleAnalyze() {
  if (!state.designImage) {
    renderFallback(
      ["请先上传设计图。"],
      ["上传设计图后，再开始自动比对。"],
      "pending",
      0
    );
    return;
  }

  if (state.riskLibrary.length === 0) {
    renderFallback(
      ["当前高风险图库为空，系统无法执行自动命中比对。"],
      ["先在下方高风险图库中添加参考图，或批量导入整个风险图库文件夹。"],
      "pending",
      0
    );
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "比对中...";

  try {
    const designProfile = buildImageProfile(state.designImage);
    const referenceResult = state.referenceImage
      ? compareProfiles(designProfile, buildImageProfile(state.referenceImage))
      : null;

    const matches = [];
    for (const item of state.riskLibrary) {
      for (const imageEntry of item.images) {
        const profile = buildProfileFromSerialized(imageEntry.profileData);
        if (!profile) {
          continue;
        }

        matches.push({
          id: `${item.id}-${imageEntry.id}`,
          libraryId: item.id,
          libraryName: item.name,
          category: item.category || "未分类",
          notes: item.notes || "",
          tags: item.tags || [],
          imageName: imageEntry.name,
          thumbnail: imageEntry.dataUrl,
          profile,
          flags: deriveLibraryFlags(item),
          similarity: compareProfiles(designProfile, profile),
        });
      }
    }

    matches.sort((a, b) => b.similarity.overallSimilarity - a.similarity.overallSimilarity);
    const topMatches = matches.slice(0, MATCH_LIMIT);
    const evaluation = evaluateRisk(designProfile, topMatches, referenceResult);

    state.lastResult = {
      analyzedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      designFile: designHint.textContent,
      referenceFile: referenceHint.textContent,
      notes: notesInput.value.trim(),
      topMatches,
      referenceResult,
      evaluation,
      thresholds: { ...state.thresholds },
      librarySize: state.riskLibrary.reduce((sum, item) => sum + item.images.length, 0),
    };

    renderResult(topMatches, referenceResult, evaluation);
  } catch (error) {
    renderFallback(
      ["自动比对失败，可能是图片损坏或浏览器可用内存不足。"],
      ["尝试压缩图片、减少图库数量，或刷新页面后再试。"],
      "pending",
      0
    );
    analysisSummary.textContent = `错误信息：${error.message}`;
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "开始自动比对";
  }
}

function handleImageSelection(file, type) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const image = await loadImage(reader.result);

    if (type === "design") {
      state.designImage = image;
      state.designDataUrl = reader.result;
      designPreview.src = reader.result;
      designPreview.hidden = false;
      designHint.textContent = file.name;
    } else {
      state.referenceImage = image;
      state.referenceDataUrl = reader.result;
      referencePreview.src = reader.result;
      referencePreview.hidden = false;
      referenceHint.textContent = file.name;
    }

    renderComparePreview();
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

async function addLibraryEntry() {
  const name = libraryNameInput.value.trim();
  const category = libraryCategoryInput.value.trim();
  const notes = libraryNotesInput.value.trim();
  const tags = parseTags(libraryTagsInput.value);
  const files = Array.from(libraryFilesInput.files || []).filter((file) => file.type.startsWith("image/"));

  if (!name) {
    libraryStatus.textContent = "请先填写风险对象名称。";
    return;
  }
  if (files.length === 0) {
    libraryStatus.textContent = "请至少上传一张参考图。";
    return;
  }

  addLibraryButton.disabled = true;
  addLibraryButton.textContent = "处理中...";

  try {
    const entry = {
      id: cryptoRandomId(),
      name,
      category,
      notes,
      tags,
      createdAt: new Date().toISOString(),
      images: await buildLibraryImages(files),
    };

    mergeLibraryEntry(entry);
    saveRiskLibrary(state.riskLibrary);
    renderLibrary();
    resetLibraryForm();
    libraryStatus.textContent = `已加入图库：${name}`;
  } catch (error) {
    libraryStatus.textContent = `加入图库失败：${error.message}`;
  } finally {
    addLibraryButton.disabled = false;
    addLibraryButton.textContent = "加入图库";
  }
}

async function importLibraryFolder(event) {
  const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
  if (files.length === 0) {
    return;
  }

  libraryStatus.textContent = `正在批量导入 ${files.length} 张图片...`;
  try {
    const grouped = groupFilesByFolder(files);
    for (const group of grouped) {
      const entry = {
        id: cryptoRandomId(),
        name: group.name,
        category: group.category,
        notes: "批量导入",
        tags: inferTagsFromGroup(group),
        createdAt: new Date().toISOString(),
        images: await buildLibraryImages(group.files),
      };
      mergeLibraryEntry(entry);
    }

    saveRiskLibrary(state.riskLibrary);
    renderLibrary();
    libraryStatus.textContent = `批量导入完成，共处理 ${files.length} 张图片，分为 ${grouped.length} 组。`;
  } catch (error) {
    libraryStatus.textContent = `批量导入失败：${error.message}`;
  } finally {
    batchLibraryInput.value = "";
  }
}

function groupFilesByFolder(files) {
  const groups = new Map();

  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name;
    const parts = relativePath.split("/").filter(Boolean);
    const fileName = parts.at(-1) || file.name;
    const leafFolder = parts.length >= 2 ? parts.at(-2) : inferNameFromFileName(fileName);
    const topFolder = parts.length >= 3 ? parts.at(-3) : "批量导入";
    const groupKey = `${topFolder}__${leafFolder}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        category: topFolder,
        name: leafFolder,
        files: [],
      });
    }
    groups.get(groupKey).files.push(file);
  }

  return [...groups.values()];
}

function inferNameFromFileName(fileName) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "未命名对象";
}

function inferTagsFromGroup(group) {
  return uniqueList([group.category, group.name].filter(Boolean));
}

async function buildLibraryImages(files) {
  const images = [];
  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    const profile = buildImageProfile(image);
    images.push({
      id: cryptoRandomId(),
      name: file.name,
      dataUrl,
      profileData: serializeProfile(profile),
    });
  }
  return images;
}

function mergeLibraryEntry(entry) {
  const existing = state.riskLibrary.find((item) =>
    item.name.trim().toLowerCase() === entry.name.trim().toLowerCase() &&
    (item.category || "").trim().toLowerCase() === (entry.category || "").trim().toLowerCase()
  );

  if (existing) {
    existing.notes = existing.notes || entry.notes;
    existing.tags = uniqueList([...(existing.tags || []), ...(entry.tags || [])]);
    existing.images.push(...entry.images);
  } else {
    state.riskLibrary.push(entry);
  }
}

function exportRiskLibrary() {
  const payload = JSON.stringify(state.riskLibrary, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  triggerDownload(blob, `risk-library-${Date.now()}.json`);
}

async function importRiskLibrary(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("图库文件格式不正确");
    }

    state.riskLibrary = parsed.map(normalizeLibraryItem);
    saveRiskLibrary(state.riskLibrary);
    renderLibrary();
    libraryStatus.textContent = `已导入图库，共 ${state.riskLibrary.length} 个对象。`;
  } catch (error) {
    libraryStatus.textContent = `导入失败：${error.message}`;
  } finally {
    importLibraryInput.value = "";
  }
}

function clearRiskLibrary() {
  state.riskLibrary = [];
  saveRiskLibrary(state.riskLibrary);
  renderLibrary();
  libraryStatus.textContent = "图库已清空。";
}

function renderLibrary() {
  if (state.riskLibrary.length === 0) {
    libraryGrid.innerHTML = "";
    libraryStatus.textContent = "当前图库为空。";
    syncLibraryFilters([], []);
    return;
  }

  const imageCount = state.riskLibrary.reduce((sum, item) => sum + item.images.length, 0);
  const categories = [...new Set(state.riskLibrary.map((item) => item.category).filter(Boolean))].sort();
  const tags = [...new Set(state.riskLibrary.flatMap((item) => item.tags || []).filter(Boolean))].sort();
  syncLibraryFilters(categories, tags);

  const visibleItems = state.riskLibrary.filter(matchesCurrentFilter);
  libraryStatus.textContent = `当前图库共 ${state.riskLibrary.length} 个对象、${imageCount} 张参考图；当前显示 ${visibleItems.length} 个对象。`;

  libraryGrid.innerHTML = visibleItems.map((item) => renderLibraryItem(item)).join("");
  libraryGrid.querySelectorAll("[data-remove-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.riskLibrary = state.riskLibrary.filter((item) => item.id !== button.dataset.removeId);
      saveRiskLibrary(state.riskLibrary);
      renderLibrary();
    });
  });
}

function renderLibraryItem(item) {
  const flags = deriveLibraryFlags(item);
  const thumbs = item.images
    .slice(0, 3)
    .map((image) => `<img src="${image.dataUrl}" alt="${escapeHtml(item.name)}" />`)
    .join("");
  const badges = [];
  if (flags.isBrandIp) {
    badges.push('<span class="flag-chip">品牌/IP 库</span>');
  }

  return `
    <article class="library-item">
      <h3>${escapeHtml(item.name)}</h3>
      <div class="library-meta">${escapeHtml(item.category || "未分类")} · ${item.images.length} 张图</div>
      <div class="library-badges">${badges.join("")}</div>
      <div class="library-thumbs">${thumbs}</div>
      ${renderTagList(item.tags || [])}
      <div class="library-meta">${escapeHtml(item.notes || "无备注")}</div>
      <button type="button" data-remove-id="${item.id}">删除该项</button>
    </article>
  `;
}

function handleLibraryFilterChange() {
  state.filters.search = librarySearchInput.value.trim().toLowerCase();
  state.filters.category = libraryCategoryFilter.value;
  state.filters.tag = libraryTagFilter.value;
  renderLibrary();
}

function syncLibraryFilters(categories, tags) {
  syncSelectOptions(libraryCategoryFilter, categories, "全部分类", state.filters.category);
  syncSelectOptions(libraryTagFilter, tags, "全部标签", state.filters.tag);
}

function syncSelectOptions(select, values, defaultLabel, selected) {
  const safeSelected = values.includes(selected) ? selected : "";
  select.innerHTML = [`<option value="">${defaultLabel}</option>`]
    .concat(values.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`))
    .join("");
  select.value = safeSelected;
}

function matchesCurrentFilter(item) {
  const text = `${item.name} ${item.category} ${item.notes} ${(item.tags || []).join(" ")}`.toLowerCase();
  if (state.filters.search && !text.includes(state.filters.search)) {
    return false;
  }
  if (state.filters.category && item.category !== state.filters.category) {
    return false;
  }
  if (state.filters.tag && !(item.tags || []).includes(state.filters.tag)) {
    return false;
  }
  return true;
}

function deriveLibraryFlags(item) {
  const text = `${item.name} ${item.category} ${item.notes} ${(item.tags || []).join(" ")}`.toLowerCase();
  return {
    isBrandIp: BRAND_IP_KEYWORDS.some((keyword) => text.includes(keyword)),
  };
}

function buildImageProfile(image) {
  const size = 64;
  const pixels = extractPixels(image, size);
  const gray = toGrayscale(pixels);
  const edges = detectEdges(gray, size);
  const colorHistogram = buildColorHistogram(pixels);
  const blockVector = buildBlockVector(gray, size, 8);
  const maskVector = buildMaskVector(gray);
  const averageHash = buildAverageHash(gray, size);
  const differenceHash = buildDifferenceHash(gray, size);
  const maskStats = measureMask(maskVector, size);
  const edgeDensity = average(edges);

  return {
    size,
    gray: Array.from(gray),
    edges: Array.from(edges),
    colorHistogram,
    blockVector,
    maskVector,
    averageHash,
    differenceHash,
    coverageRatio: maskStats.coverageRatio,
    componentCount: maskStats.componentCount,
    largestComponentRatio: maskStats.largestComponentRatio,
    edgeDensity,
  };
}

function extractPixels(image, size) {
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

  return context.getImageData(0, 0, size, size).data;
}

function toGrayscale(pixels) {
  const result = new Float32Array(pixels.length / 4);
  for (let index = 0; index < pixels.length; index += 4) {
    result[index / 4] =
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114;
  }
  return normalizeFloatArray(result);
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
  return normalizeFloatArray(result);
}

function buildColorHistogram(pixels) {
  const buckets = new Array(36).fill(0);
  for (let index = 0; index < pixels.length; index += 4) {
    const [h, s, v] = rgbToHsv(
      pixels[index] / 255,
      pixels[index + 1] / 255,
      pixels[index + 2] / 255
    );
    const hBucket = Math.min(11, Math.floor(h * 12));
    const sBucket = Math.min(2, Math.floor(s * 3));
    buckets[hBucket * 3 + sBucket] += v;
  }
  return normalizeNumberArray(buckets);
}

function buildBlockVector(gray, size, blocksPerSide) {
  const blockSize = size / blocksPerSide;
  const result = [];
  for (let blockY = 0; blockY < blocksPerSide; blockY += 1) {
    for (let blockX = 0; blockX < blocksPerSide; blockX += 1) {
      let sum = 0;
      let count = 0;
      for (let y = 0; y < blockSize; y += 1) {
        for (let x = 0; x < blockSize; x += 1) {
          const px = Math.floor(blockX * blockSize + x);
          const py = Math.floor(blockY * blockSize + y);
          sum += gray[py * size + px];
          count += 1;
        }
      }
      result.push(count ? sum / count : 0);
    }
  }
  return normalizeNumberArray(result);
}

function buildMaskVector(gray) {
  return gray.map((value) => (value < 0.92 ? 1 : 0));
}

function buildAverageHash(gray, width) {
  const reduced = downsample(gray, width, 8);
  const averageValue = average(reduced);
  return reduced.map((value) => (value >= averageValue ? 1 : 0));
}

function buildDifferenceHash(gray, width) {
  const reduced = downsample(gray, width, 9);
  const result = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const index = y * 9 + x;
      result.push(reduced[index] > reduced[index + 1] ? 1 : 0);
    }
  }
  return result;
}

function downsample(gray, width, targetSize) {
  const result = [];
  const scale = width / targetSize;
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      let sum = 0;
      let count = 0;
      const startX = Math.floor(x * scale);
      const endX = Math.max(startX + 1, Math.floor((x + 1) * scale));
      const startY = Math.floor(y * scale);
      const endY = Math.max(startY + 1, Math.floor((y + 1) * scale));
      for (let py = startY; py < endY; py += 1) {
        for (let px = startX; px < endX; px += 1) {
          sum += gray[py * width + px];
          count += 1;
        }
      }
      result.push(count ? sum / count : 0);
    }
  }
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

function evaluateRisk(designProfile, topMatches, referenceResult) {
  const topMatch = topMatches[0];
  if (!topMatch) {
    return buildResult("low", 0, ["图库中没有可比对图片。"], ["请先建立或导入高风险图库。"], ["未命中任何图库对象。"], "无命中结果。");
  }

  const similarity = topMatch.similarity;
  const highLine = state.thresholds.high / 100;
  const mediumLine = state.thresholds.medium / 100;
  const differenceCount = computeDifferenceCount(similarity);
  const differenceRule = evaluateDifferenceRule(differenceCount);
  const patternType = inferPairPatternType(designProfile, topMatch.profile);
  const patternRule = evaluatePatternRule(patternType, similarity);
  const thresholdRule = evaluateThresholdRule(similarity.overallSimilarity, highLine, mediumLine);
  const brandRule = evaluateBrandRule(topMatch, similarity, mediumLine);
  const aiOutlineRule = evaluateOutlineRule(similarity);

  const allRules = [differenceRule, patternRule, thresholdRule, brandRule, aiOutlineRule];
  const finalRule = allRules.reduce((best, current) => {
    if (!best || levelRank(current.level) > levelRank(best.level)) {
      return current;
    }
    return best;
  }, null);

  const riskPointsList = [
    `最高命中对象为 ${topMatch.libraryName}，整体接近度 ${formatPercent(similarity.overallSimilarity)}。`,
  ];

  if (similarity.subjectSimilarity >= 0.84) {
    riskPointsList.push("主体轮廓和核心识别关系接近，主体变化不足。");
  }
  if (similarity.compositionSimilarity >= 0.78) {
    riskPointsList.push("构图关系接近，主体位置和画面重心变化有限。");
  }
  if (similarity.visualSimilarity >= 0.74) {
    riskPointsList.push("视觉表现仍接近，线条组织、色块节奏或图形气质变化不足。");
  }
  if (topMatch.flags.isBrandIp) {
    riskPointsList.push("命中的对象属于品牌/IP 风险图库，识别点应从严处理。");
  }
  if (referenceResult) {
    riskPointsList.push(`指定对比图整体接近度为 ${formatPercent(referenceResult.overallSimilarity)}。`);
  }

  const suggestionList = buildSuggestions(finalRule.level, patternType, topMatch.flags.isBrandIp);
  const summary = [
    `最终按“取最高风险规则”输出结果。`,
    `命中对象类型判断为${patternType === "single" ? "单一图案" : "组合图案"}。`,
    `三项核心维度中共有 ${differenceCount} 项明显不同。`,
  ].join("");

  return buildResult(
    finalRule.level,
    calculateRiskScore(similarity, finalRule.level, brandRule.level === "high" || aiOutlineRule.level === "high"),
    uniqueList(riskPointsList),
    suggestionList,
    allRules.map((rule) => rule.reason),
    summary
  );
}

function evaluateDifferenceRule(differenceCount) {
  if (differenceCount <= 1) {
    return {
      level: "high",
      reason: `三项核心维度中仅有 ${differenceCount} 项明显不同，按“0 项不同=高、1 项不同=高”处理。`,
    };
  }
  if (differenceCount === 2) {
    return {
      level: "medium",
      reason: "三项核心维度中有 2 项明显不同，按“2 项不同=中风险”处理。",
    };
  }
  return {
    level: "low",
    reason: "三项核心维度中有 3 项明显不同，按“3 项不同=低风险”处理。",
  };
}

function evaluatePatternRule(patternType, similarity) {
  const subjectStable =
    similarity.subjectSimilarity >= 0.84 ||
    (similarity.maskSimilarity >= 0.9 && similarity.structureSimilarity >= 0.8);
  const visualClose =
    similarity.visualSimilarity >= 0.74 ||
    (similarity.edgeSimilarity >= 0.82 && similarity.colorSimilarity >= 0.78);

  if (patternType === "single") {
    if (subjectStable && visualClose) {
      return {
        level: "high",
        reason: "判定为单一图案，主体未明显改变且视觉仍接近，按“单一图案=高风险”处理。",
      };
    }
    if (subjectStable && !visualClose) {
      return {
        level: "medium",
        reason: "判定为单一图案，主体未明显改变但视觉已有差异，按“单一图案=中风险”处理。",
      };
    }
    if (!subjectStable && !visualClose) {
      return {
        level: "low",
        reason: "判定为单一图案，主体已变化且视觉差异明显，按“单一图案=低风险”处理。",
      };
    }
    return {
      level: "medium",
      reason: "判定为单一图案，虽然主体有变化，但视觉接近度仍偏高，按中风险处理。",
    };
  }

  const differenceRatio =
    1 - (similarity.subjectSimilarity * 0.55 + similarity.compositionSimilarity * 0.45);
  if (differenceRatio < 0.5) {
    return {
      level: "high",
      reason: `判定为组合图案，结构差异约为 ${Math.round(differenceRatio * 100)}%，低于 50%，按“组合图案=高风险”处理。`,
    };
  }
  if (visualClose) {
    return {
      level: "medium",
      reason: `判定为组合图案，结构差异约为 ${Math.round(differenceRatio * 100)}%，已达到 50% 以上，但视觉仍接近，按中风险处理。`,
    };
  }
  return {
    level: "low",
    reason: `判定为组合图案，结构差异约为 ${Math.round(differenceRatio * 100)}%，已达到 50% 以上且视觉差异明显，按低风险处理。`,
  };
}

function evaluateThresholdRule(overallSimilarity, highLine, mediumLine) {
  if (overallSimilarity >= highLine) {
    return {
      level: "high",
      reason: `整体接近度 ${formatPercent(overallSimilarity)}，达到当前高风险阈值 ${Math.round(highLine * 100)}%。`,
    };
  }
  if (overallSimilarity >= mediumLine) {
    return {
      level: "medium",
      reason: `整体接近度 ${formatPercent(overallSimilarity)}，落在当前中风险阈值 ${Math.round(mediumLine * 100)}% 以上。`,
    };
  }
  return {
    level: "low",
    reason: `整体接近度 ${formatPercent(overallSimilarity)}，低于当前中风险阈值 ${Math.round(mediumLine * 100)}%。`,
  };
}

function evaluateBrandRule(topMatch, similarity, mediumLine) {
  if (topMatch.flags.isBrandIp && (similarity.subjectSimilarity >= 0.78 || similarity.overallSimilarity >= mediumLine)) {
    return {
      level: "high",
      reason: "命中的图库对象属于品牌/IP 风险库，触发“一票高风险”规则。",
    };
  }
  return {
    level: "low",
    reason: "未触发品牌/IP 一票高风险规则。",
  };
}

function evaluateOutlineRule(similarity) {
  if (similarity.maskSimilarity >= 0.93 && similarity.edgeSimilarity >= 0.86) {
    return {
      level: "high",
      reason: "轮廓保留度很高，触发“AI 保留原轮廓=高风险”规则。",
    };
  }
  return {
    level: "low",
    reason: "未触发“AI 保留原轮廓”高风险规则。",
  };
}

function computeDifferenceCount(similarity) {
  const subjectDifferent = similarity.subjectSimilarity < 0.84;
  const compositionDifferent = similarity.compositionSimilarity < 0.78;
  const visualDifferent = similarity.visualSimilarity < 0.74;
  return [subjectDifferent, compositionDifferent, visualDifferent].filter(Boolean).length;
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

function buildSuggestions(level, patternType, isBrandIp) {
  const items = [];

  if (level === "high") {
    items.push("建议先暂停使用当前方案，优先重做主体轮廓、构图关系和关键识别细节。");
  } else if (level === "medium") {
    items.push("建议修改后重新比对，重点避免主体和画面关系继续接近。");
  } else {
    items.push("建议保留本次比对记录，并在扩充图库后再次复核。");
  }

  if (patternType === "single") {
    items.push("单一图案优先改主体轮廓、五官结构、典型姿态和标志性色块。");
  } else {
    items.push("组合图案优先打散主体排列方式、元素数量关系和画面重心。");
  }

  if (isBrandIp) {
    items.push("品牌/IP 命中时，不要只改颜色，需同步改变角色识别点和轮廓特征。");
  } else {
    items.push("不要只做局部微调，建议同时改主体、构图和视觉气质。");
  }

  return uniqueList(items);
}

function calculateRiskScore(similarity, level, forcedHigh) {
  const base = Math.round(
    similarity.overallSimilarity * 40 +
    similarity.subjectSimilarity * 25 +
    similarity.compositionSimilarity * 20 +
    similarity.visualSimilarity * 15
  );

  if (forcedHigh) {
    return Math.max(90, base);
  }
  if (level === "high") {
    return Math.max(85, base);
  }
  if (level === "medium") {
    return clamp(base, 60, 84);
  }
  return Math.min(base, 59);
}

function buildResult(level, score, riskPointsList, suggestionList, reasonsList, summary) {
  return {
    level,
    label: levelToLabel(level),
    score,
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
    riskPoints: riskPointsList,
    suggestions: suggestionList,
    reasons: reasonsList,
    summary,
  };
}

function renderResult(topMatches, referenceResult, evaluation) {
  const topMatch = topMatches[0];
  riskBanner.dataset.level = evaluation.level;
  riskBanner.querySelector(".risk-label").textContent = evaluation.label;
  riskScore.textContent = `${evaluation.score}分`;

  if (topMatch) {
    shapeMetric.textContent = formatPercent(topMatch.similarity.subjectSimilarity);
    colorMetric.textContent = formatPercent(topMatch.similarity.compositionSimilarity);
    edgeMetric.textContent = formatPercent(topMatch.similarity.visualSimilarity);
    overallMetric.textContent = formatPercent(topMatch.similarity.overallSimilarity);
  } else {
    shapeMetric.textContent = "-";
    colorMetric.textContent = "-";
    edgeMetric.textContent = "-";
    overallMetric.textContent = "-";
  }

  reviewAdvice.textContent = evaluation.reviewAdviceText;
  usageAdvice.textContent = evaluation.usageAdviceText;
  compareDesignPreview.src = state.designDataUrl || "";
  compareMatchPreview.src = topMatch?.thumbnail || "";
  compareMatchLabel.textContent = topMatch
    ? `${topMatch.libraryName}｜${topMatch.category}｜整体 ${formatPercent(topMatch.similarity.overallSimilarity)}`
    : "暂无命中";

  libraryMatches.innerHTML = topMatches.length
    ? topMatches.map((match, index) => renderMatchCard(match, index)).join("")
    : '<div class="match-empty">暂无自动比对结果。</div>';

  if (referenceResult) {
    referenceSummary.textContent =
      `指定对比图整体接近度 ${formatPercent(referenceResult.overallSimilarity)}，` +
      `主体 ${formatPercent(referenceResult.subjectSimilarity)}，` +
      `构图 ${formatPercent(referenceResult.compositionSimilarity)}，` +
      `视觉 ${formatPercent(referenceResult.visualSimilarity)}。`;
  } else {
    referenceSummary.textContent = "未上传指定对比图。";
  }

  ruleReasons.innerHTML = evaluation.reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  riskPoints.innerHTML = evaluation.riskPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  suggestions.innerHTML = evaluation.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  const imageCount = state.riskLibrary.reduce((sum, item) => sum + item.images.length, 0);
  analysisSummary.textContent =
    `${evaluation.summary} 当前共比对 ${imageCount} 张图库参考图。` +
    ` 当前阈值为：高风险 ${state.thresholds.high}% / 中风险 ${state.thresholds.medium}%。`;
}

function renderMatchCard(match, index) {
  const badges = [];
  if (match.flags.isBrandIp) {
    badges.push('<span class="flag-chip">品牌/IP</span>');
  }

  return `
    <article class="match-card">
      <img src="${match.thumbnail}" alt="${escapeHtml(match.libraryName)}" />
      <div>
        <h4>Top ${index + 1} · ${escapeHtml(match.libraryName)}</h4>
        <div class="match-meta">${escapeHtml(match.category)} · ${escapeHtml(match.imageName)}</div>
        <div class="library-badges">${badges.join("")}</div>
        ${renderTagList(match.tags || [])}
        <div class="match-score">
          整体 ${formatPercent(match.similarity.overallSimilarity)} ·
          主体 ${formatPercent(match.similarity.subjectSimilarity)} ·
          构图 ${formatPercent(match.similarity.compositionSimilarity)} ·
          视觉 ${formatPercent(match.similarity.visualSimilarity)}
        </div>
        <div class="match-notes">${escapeHtml(match.notes || "无备注")}</div>
      </div>
    </article>
  `;
}

function renderTagList(tags) {
  if (!tags.length) {
    return "";
  }
  return `<div class="tag-list">${tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}</div>`;
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
  libraryMatches.innerHTML = '<div class="match-empty">暂无自动比对结果。</div>';
  referenceSummary.textContent = "未上传指定对比图。";
  compareDesignPreview.src = state.designDataUrl || "";
  compareMatchPreview.src = "";
  compareMatchLabel.textContent = "等待分析";
  ruleReasons.innerHTML = "<li>暂无规则判定结果。</li>";
  riskPoints.innerHTML = risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  suggestions.innerHTML = suggestionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderComparePreview() {
  compareDesignPreview.src = state.designDataUrl || "";
  compareMatchPreview.src = "";
  compareMatchLabel.textContent = "等待分析";
}

function loadRiskLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeLibraryItem) : [];
  } catch (_) {
    return [];
  }
}

function saveRiskLibrary(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadThresholds() {
  try {
    const raw = localStorage.getItem(THRESHOLD_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_THRESHOLDS };
    }
    const parsed = JSON.parse(raw);
    return normalizeThresholds(parsed.high, parsed.medium);
  } catch (_) {
    return { ...DEFAULT_THRESHOLDS };
  }
}

function saveThresholds() {
  localStorage.setItem(THRESHOLD_STORAGE_KEY, JSON.stringify(state.thresholds));
}

function normalizeThresholds(high, medium) {
  let safeHigh = clamp(Number(high) || DEFAULT_THRESHOLDS.high, 70, 98);
  let safeMedium = clamp(Number(medium) || DEFAULT_THRESHOLDS.medium, 55, 90);

  if (safeMedium >= safeHigh) {
    safeMedium = safeHigh - 1;
  }
  if (safeMedium < 55) {
    safeMedium = 55;
    if (safeMedium >= safeHigh) {
      safeHigh = safeMedium + 1;
    }
  }

  return { high: safeHigh, medium: safeMedium };
}

function handleThresholdInput() {
  state.thresholds = normalizeThresholds(highThresholdInput.value, mediumThresholdInput.value);
  syncThresholdControls();
  saveThresholds();
}

function syncThresholdControls() {
  highThresholdInput.value = String(state.thresholds.high);
  mediumThresholdInput.value = String(state.thresholds.medium);
  highThresholdValue.textContent = `${state.thresholds.high}%`;
  mediumThresholdValue.textContent = `${state.thresholds.medium}%`;
}

function normalizeLibraryItem(item) {
  return {
    id: item.id || cryptoRandomId(),
    name: item.name || "未命名对象",
    category: item.category || "",
    notes: item.notes || "",
    tags: Array.isArray(item.tags) ? item.tags.filter(Boolean).map(String) : [],
    createdAt: item.createdAt || new Date().toISOString(),
    images: Array.isArray(item.images)
      ? item.images
          .filter((image) => image && image.dataUrl && image.profileData)
          .map((image) => ({
            id: image.id || cryptoRandomId(),
            name: image.name || "未命名图片",
            dataUrl: image.dataUrl,
            profileData: image.profileData,
          }))
      : [],
  };
}

function serializeProfile(profile) {
  return {
    size: profile.size,
    gray: Array.from(profile.gray),
    edges: Array.from(profile.edges),
    colorHistogram: Array.from(profile.colorHistogram),
    blockVector: Array.from(profile.blockVector),
    maskVector: Array.from(profile.maskVector),
    averageHash: Array.from(profile.averageHash),
    differenceHash: Array.from(profile.differenceHash),
    coverageRatio: profile.coverageRatio,
    componentCount: profile.componentCount,
    largestComponentRatio: profile.largestComponentRatio,
    edgeDensity: profile.edgeDensity,
  };
}

function buildProfileFromSerialized(profileData) {
  if (!profileData) {
    return null;
  }

  return {
    size: profileData.size,
    gray: profileData.gray || [],
    edges: profileData.edges || [],
    colorHistogram: profileData.colorHistogram || [],
    blockVector: profileData.blockVector || [],
    maskVector: profileData.maskVector || [],
    averageHash: profileData.averageHash || [],
    differenceHash: profileData.differenceHash || [],
    coverageRatio: profileData.coverageRatio ?? 0,
    componentCount: profileData.componentCount ?? 0,
    largestComponentRatio: profileData.largestComponentRatio ?? 0,
    edgeDensity: profileData.edgeDensity ?? 0,
  };
}

function resetLibraryForm() {
  libraryNameInput.value = "";
  libraryCategoryInput.value = "";
  libraryNotesInput.value = "";
  libraryTagsInput.value = "";
  libraryFilesInput.value = "";
}

function parseTags(value) {
  return uniqueList(
    value
      .split(/[,，/\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

function measureMask(maskVector, width) {
  const visited = new Uint8Array(maskVector.length);
  const largeComponents = [];
  let activePixels = 0;

  for (let index = 0; index < maskVector.length; index += 1) {
    if (!maskVector[index]) {
      continue;
    }
    activePixels += 1;
    if (visited[index]) {
      continue;
    }

    const stack = [index];
    visited[index] = 1;
    let size = 0;

    while (stack.length) {
      const current = stack.pop();
      size += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= width) {
          continue;
        }
        const nextIndex = ny * width + nx;
        if (!maskVector[nextIndex] || visited[nextIndex]) {
          continue;
        }
        visited[nextIndex] = 1;
        stack.push(nextIndex);
      }
    }

    if (size >= 12) {
      largeComponents.push(size);
    }
  }

  const componentCount = largeComponents.length;
  const largestComponentRatio =
    activePixels > 0 && largeComponents.length > 0 ? Math.max(...largeComponents) / activePixels : 0;

  return {
    coverageRatio: activePixels / maskVector.length,
    componentCount,
    largestComponentRatio,
  };
}

function overlapSimilarity(a, b) {
  let overlap = 0;
  let total = 0;
  for (let index = 0; index < a.length; index += 1) {
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

function normalizeFloatArray(values) {
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

function normalizeNumberArray(values) {
  let max = 0;
  for (const value of values) {
    if (value > max) {
      max = value;
    }
  }
  if (max === 0) {
    return values.map(() => 0);
  }
  return values.map((value) => value / max);
}

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h /= 6;
    if (h < 0) {
      h += 1;
    }
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return [h, s, v];
}

function exportReport(result) {
  const content = [
    "图像侵权自动比对报告",
    `分析时间：${result.analyzedAt}`,
    `设计图：${result.designFile}`,
    `指定对比图：${result.referenceFile || "无"}`,
    `设计补充说明：${result.notes || "无"}`,
    "",
    "一、风险结论",
    `风险等级：${result.evaluation.label}`,
    `风险评分：${result.evaluation.score}分`,
    `审核建议：${result.evaluation.reviewAdviceText}`,
    `使用建议：${result.evaluation.usageAdviceText}`,
    "",
    "二、规则判定依据",
    ...result.evaluation.reasons.map((item, index) => `${index + 1}. ${item}`),
    "",
    "三、图库命中 Top 5",
    ...result.topMatches.map((match, index) =>
      `${index + 1}. ${match.libraryName} / ${match.category} / ${match.imageName} / 整体 ${formatPercent(match.similarity.overallSimilarity)} / 主体 ${formatPercent(match.similarity.subjectSimilarity)} / 构图 ${formatPercent(match.similarity.compositionSimilarity)} / 视觉 ${formatPercent(match.similarity.visualSimilarity)}`
    ),
    "",
    "四、指定对比图结果",
    result.referenceResult
      ? `整体 ${formatPercent(result.referenceResult.overallSimilarity)} / 主体 ${formatPercent(result.referenceResult.subjectSimilarity)} / 构图 ${formatPercent(result.referenceResult.compositionSimilarity)} / 视觉 ${formatPercent(result.referenceResult.visualSimilarity)}`
      : "无指定对比图",
    "",
    "五、风险关注点",
    ...result.evaluation.riskPoints.map((item, index) => `${index + 1}. ${item}`),
    "",
    "六、修改建议",
    ...result.evaluation.suggestions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "七、说明",
    `本次共比对 ${result.librarySize} 张图库参考图。`,
    `当前阈值：高风险 ${result.thresholds.high}% / 中风险 ${result.thresholds.medium}%。`,
    "本结果基于浏览器本地图像相似度计算，仅用于内部初筛，不构成正式法律意见。",
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, `图像自动比对报告-${Date.now()}.txt`);
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total / values.length;
}

function levelToLabel(level) {
  if (level === "high") {
    return "高风险";
  }
  if (level === "medium") {
    return "中风险";
  }
  if (level === "low") {
    return "低风险";
  }
  return "等待分析";
}

function levelRank(level) {
  if (level === "high") {
    return 3;
  }
  if (level === "medium") {
    return 2;
  }
  if (level === "low") {
    return 1;
  }
  return 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function uniqueList(items) {
  return [...new Set(items)];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return String(value).replaceAll('"', "&quot;");
}
