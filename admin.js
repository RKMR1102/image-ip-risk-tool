const ADMIN_TOKEN_STORAGE_KEY = "image-risk-admin-token";

const loginPanel = document.getElementById("loginPanel");
const protectedArea = document.getElementById("protectedArea");
const adminTokenInput = document.getElementById("adminTokenInput");
const saveTokenButton = document.getElementById("saveTokenButton");
const adminAuthStatus = document.getElementById("adminAuthStatus");
const logoutButton = document.getElementById("logoutButton");
const adminSessionStatus = document.getElementById("adminSessionStatus");
const libraryNameInput = document.getElementById("libraryNameInput");
const libraryCategoryInput = document.getElementById("libraryCategoryInput");
const libraryTagsInput = document.getElementById("libraryTagsInput");
const libraryNotesInput = document.getElementById("libraryNotesInput");
const brandIpCheckbox = document.getElementById("brandIpCheckbox");
const libraryFilesInput = document.getElementById("libraryFilesInput");
const batchLibraryInput = document.getElementById("batchLibraryInput");
const addLibraryButton = document.getElementById("addLibraryButton");
const refreshLibraryButton = document.getElementById("refreshLibraryButton");
const libraryStatus = document.getElementById("libraryStatus");
const libraryGrid = document.getElementById("libraryGrid");

const state = {
  token: sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "",
};

adminTokenInput.value = state.token;
renderAuthStatus();
setProtectedState(Boolean(state.token));

if (state.token) {
  loadLibrary();
}

saveTokenButton.addEventListener("click", () => {
  state.token = adminTokenInput.value.trim();
  if (!state.token) {
    adminAuthStatus.textContent = "请输入管理密码。";
    return;
  }

  sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, state.token);
  renderAuthStatus();
  setProtectedState(true);
  loadLibrary();
});

logoutButton.addEventListener("click", () => {
  state.token = "";
  sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  adminTokenInput.value = "";
  libraryGrid.innerHTML = "";
  renderAuthStatus();
  setProtectedState(false);
});

addLibraryButton.addEventListener("click", async () => {
  const name = libraryNameInput.value.trim();
  const category = libraryCategoryInput.value.trim();
  const tags = ImageRiskCore.parseTags(libraryTagsInput.value);
  const notes = libraryNotesInput.value.trim();
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
  libraryStatus.textContent = "正在生成图片特征并上传...";

  try {
    const images = [];
    for (const file of files) {
      const result = await ImageRiskCore.buildProfileFromFile(file);
      images.push({
        id: ImageRiskCore.cryptoRandomId(),
        name: file.name,
        dataUrl: result.dataUrl,
        profileData: result.profile,
      });
    }

    await apiRequest("/api/library", {
      method: "POST",
      body: {
        entries: [{
          id: ImageRiskCore.cryptoRandomId(),
          name,
          category,
          notes,
          tags,
          flags: {
            isBrandIp: brandIpCheckbox.checked,
          },
          createdAt: new Date().toISOString(),
          images,
        }],
      },
    });

    resetForm();
    libraryStatus.textContent = `已加入图库：${name}`;
    await loadLibrary();
  } catch (error) {
    libraryStatus.textContent = `加入图库失败：${error.message}`;
  } finally {
    addLibraryButton.disabled = false;
    addLibraryButton.textContent = "加入图库";
  }
});

batchLibraryInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) {
    return;
  }

  libraryStatus.textContent = `正在批量处理 ${files.length} 张图片...`;
  try {
    const groups = ImageRiskCore.groupFilesByFolder(files);
    const entries = [];

    for (const group of groups) {
      const images = [];
      for (const file of group.files) {
        const result = await ImageRiskCore.buildProfileFromFile(file);
        images.push({
          id: ImageRiskCore.cryptoRandomId(),
          name: file.name,
          dataUrl: result.dataUrl,
          profileData: result.profile,
        });
      }

      entries.push({
        id: ImageRiskCore.cryptoRandomId(),
        name: group.name,
        category: group.category,
        notes: "批量导入",
        tags: [group.category, group.name].filter(Boolean),
        flags: {
          isBrandIp: true,
        },
        createdAt: new Date().toISOString(),
        images,
      });
    }

    await apiRequest("/api/library", {
      method: "POST",
      body: { entries },
    });

    libraryStatus.textContent = `批量导入完成，共新增 ${entries.length} 个对象。`;
    await loadLibrary();
  } catch (error) {
    libraryStatus.textContent = `批量导入失败：${error.message}`;
  } finally {
    batchLibraryInput.value = "";
  }
});

refreshLibraryButton.addEventListener("click", loadLibrary);

function renderAuthStatus() {
  adminAuthStatus.textContent = state.token
    ? "已输入管理密码，可以进入管理端。"
    : "当前未登录管理端。";
}

function setProtectedState(isLoggedIn) {
  loginPanel.hidden = isLoggedIn;
  protectedArea.hidden = !isLoggedIn;
  if (adminSessionStatus) {
    adminSessionStatus.textContent = isLoggedIn ? "当前已登录管理端。" : "";
  }
}

async function loadLibrary() {
  libraryStatus.textContent = "正在读取图库...";
  try {
    const response = await apiRequest("/api/library", { method: "GET" });
    const items = response.items || [];

    if (!items.length) {
      libraryGrid.innerHTML = '<div class="match-empty">当前图库为空。</div>';
      libraryStatus.textContent = response.authConfigured
        ? "图库为空。"
        : "图库为空。当前后端未配置管理员令牌，线上建议补充安全配置。";
      return;
    }

    libraryGrid.innerHTML = items.map((item) => renderLibraryItem(item)).join("");
    libraryGrid.querySelectorAll("[data-remove-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.removeId;
        button.disabled = true;
        try {
          await apiRequest("/api/library", {
            method: "DELETE",
            body: { id },
          });
          libraryStatus.textContent = "删除成功。";
          await loadLibrary();
        } catch (error) {
          button.disabled = false;
          libraryStatus.textContent = `删除失败：${error.message}`;
        }
      });
    });

    libraryStatus.textContent = response.authConfigured
      ? `图库加载完成，共 ${items.length} 个对象。`
      : `图库加载完成，共 ${items.length} 个对象。当前后端未配置管理员令牌。`;
  } catch (error) {
    libraryGrid.innerHTML = '<div class="match-empty">图库读取失败。</div>';
    libraryStatus.textContent = `读取图库失败：${error.message}`;
    if (String(error.message).includes("管理员令牌")) {
      adminAuthStatus.textContent = "管理密码不正确，请重新输入。";
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      state.token = "";
      adminTokenInput.value = "";
      setProtectedState(false);
    }
  }
}

function renderLibraryItem(item) {
  const thumbs = (item.images || [])
    .slice(0, 3)
    .map((image) => `<img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(item.name)}" />`)
    .join("");
  const tags = (item.tags || []).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("");
  const flags = item.flags?.isBrandIp ? '<span class="flag-chip">品牌 / IP</span>' : "";

  return `
    <article class="library-item">
      <h3>${escapeHtml(item.name)}</h3>
      <div class="library-meta">${escapeHtml(item.category || "未分类")} · ${(item.images || []).length} 张图</div>
      <div class="library-badges">${flags}</div>
      <div class="library-thumbs">${thumbs}</div>
      <div class="tag-list">${tags}</div>
      <div class="library-meta">${escapeHtml(item.notes || "无备注")}</div>
      <button type="button" data-remove-id="${item.id}">删除该项</button>
    </article>
  `;
}

function resetForm() {
  libraryNameInput.value = "";
  libraryCategoryInput.value = "";
  libraryTagsInput.value = "";
  libraryNotesInput.value = "";
  libraryFilesInput.value = "";
  brandIpCheckbox.checked = false;
}

async function apiRequest(url, options) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": state.token,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
