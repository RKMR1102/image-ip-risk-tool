(function attachImageRiskCore() {
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("无法读取图片"));
      image.src = src;
    });
  }

  async function buildProfileFromFile(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    return {
      dataUrl,
      profile: buildImageProfile(image),
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

    return {
      coverageRatio: activePixels / maskVector.length,
      componentCount: largeComponents.length,
      largestComponentRatio:
        activePixels > 0 && largeComponents.length > 0 ? Math.max(...largeComponents) / activePixels : 0,
    };
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
    return [h, s, max];
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

  function parseTags(value) {
    return [...new Set(
      value
        .split(/[,，/\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )];
  }

  function cryptoRandomId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  window.ImageRiskCore = {
    buildProfileFromFile,
    buildImageProfile,
    parseTags,
    cryptoRandomId,
    groupFilesByFolder,
    inferNameFromFileName,
  };
})();
