# 图像侵权风险系统

这是已经改成“本机 / 内网服务器 + 本地固定图库目录”的版本。

它不再依赖 Vercel 的本地文件持久化，而是默认把高风险图库放到：

- `C:\Users\patpat\Documents\image-ip-risk-library`

如果你想改到别的位置，也可以改成：

- 其他本地盘，例如 `D:\image-ip-risk-library`
- 共享盘 / NAS，例如 `\\192.168.1.20\design-share\image-ip-risk-library`

## 系统结构

- `index.html`：系统首页
- `admin.html`：高风险图库管理端
- `check.html`：设计图比对分析端
- `server.js`：本地 Node 服务
- `api/library.js`：图库管理接口
- `api/analyze.js`：统一分析接口

## 当前工作方式

1. 管理端上传高风险对象图片
2. 浏览器先提取图片特征
3. 后端把图库数据写入本地盘
4. 分析端上传设计图
5. 浏览器提取设计图特征
6. 后端读取统一图库并执行风险规则

## 默认存储位置

默认图库根目录：

- `C:\Users\patpat\Documents\image-ip-risk-library`

默认图库数据文件：

- `C:\Users\patpat\Documents\image-ip-risk-library\data\risk-library.json`

## 启动方式

### 方式 1：双击启动

直接双击：

- `start-local-server.bat`

默认会使用：

- 端口 `3100`
- 图库目录 `C:\Users\patpat\Documents\image-ip-risk-library`

启动后可访问：

- `http://localhost:3100/index.html`
- `http://localhost:3100/admin.html`
- `http://localhost:3100/check.html`

如果你的电脑在局域网里，控制台也会显示局域网访问地址，其他同事可通过该地址访问。

### 方式 2：命令行启动

```powershell
cd C:\Users\patpat\Documents\Codex\2026-06-02\new-chat\outputs\image-ip-risk-tool
node server.js
```

## 自定义图库目录

### 改成本地其他盘

```powershell
$env:RISK_LIBRARY_ROOT="E:\image-ip-risk-library"
node server.js
```

### 改成共享盘 / NAS

```powershell
$env:RISK_LIBRARY_ROOT="\\192.168.1.20\design-share\image-ip-risk-library"
node server.js
```

## 管理端权限

如果要限制只有图库维护人员能进管理接口，可以设置：

```powershell
$env:ADMIN_TOKEN="your-admin-token"
node server.js
```

然后管理端页面输入同一个令牌后，才能新增 / 删除图库。

如果不设置 `ADMIN_TOKEN`，默认不拦截管理接口。

当前默认启动脚本已经内置了一个管理密码：

- `PatPatAdmin2026!`

打开管理端时输入这个密码即可进入。后续如果你想改密码，可以编辑：

- `start-local-server.bat`

把其中的 `ADMIN_TOKEN` 改成你自己的值，然后重启服务。

## 风险规则

后端统一执行这些规则：

- `0 项不同 = 高风险`
- `1 项不同 = 高风险`
- `2 项不同 = 中风险`
- `3 项不同 = 低风险`
- `单一图案：主体没变且视觉接近 = 高风险`
- `单一图案：主体没变但视觉不同 = 中风险`
- `单一图案：主体变了且视觉不同 = 低风险`
- `组合图案：差异 < 50% = 高风险`
- `组合图案：差异 >= 50% 但视觉接近 = 中风险`
- `组合图案：差异 >= 50% 且视觉不同 = 低风险`
- `品牌 / IP = 高风险`
- `AI 保留原轮廓 = 高风险`

最终按“取最高风险规则”输出结果。

## 共享盘使用建议

如果你要给多人用，推荐：

1. 把 `server.js` 跑在一台固定电脑或公司服务器上
2. 把 `RISK_LIBRARY_ROOT` 指向该机器本地盘或共享盘
3. 管理人员访问 `admin.html`
4. 设计人员访问 `check.html`

这样图库统一、结果统一，也不会依赖每个人浏览器本地数据。
