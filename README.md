# 图片侵权比对分析工具

这是一个可直接部署的静态网页工具，适合放到 `Vercel`、`Netlify`、`GitHub Pages` 或公司内网静态服务器。

## 功能

- 上传设计图和对比图
- 计算结构相似度、边缘相似度、颜色相似度
- 结合人工输入项进行规则评分
- 输出低风险 / 中风险 / 高风险
- 给出高风险点与修改建议

## 文件结构

- `index.html`：页面结构
- `styles.css`：样式
- `app.js`：前端分析逻辑
- `vercel.json`：Vercel 部署配置
- `netlify.toml`：Netlify 部署配置

## 本地打开

直接双击 `index.html` 即可使用。

如果你想本地跑一个简单站点，可以在当前目录执行：

```powershell
python -m http.server 8080
```

然后访问：

`http://localhost:8080`

## 部署到 Vercel

1. 把整个 `image-ip-risk-tool` 文件夹上传到一个 Git 仓库
2. 登录 [Vercel](https://vercel.com/)
3. 导入该仓库
4. 框架选择 `Other`
5. 构建命令留空
6. 输出目录留空或填 `.`
7. 部署完成后即可得到公网网址

## 部署到 Netlify

1. 把整个 `image-ip-risk-tool` 文件夹上传到一个 Git 仓库
2. 登录 [Netlify](https://www.netlify.com/)
3. 新建站点并连接仓库
4. Build command 留空
5. Publish directory 填 `.`
6. 部署完成后即可得到公网网址

## 部署到 GitHub Pages

1. 新建 GitHub 仓库
2. 上传当前目录全部文件
3. 在仓库 `Settings -> Pages`
4. Source 选择 `Deploy from a branch`
5. Branch 选择 `main`，目录选 `/root`
6. 保存后等待生成网址

## 注意事项

- 当前逻辑是浏览器端规则引擎，不依赖后端
- 图片不会上传到服务器，适合内部敏感素材做本地分析
- 如果后续要做更强的侵权识别，建议增加：
  - 审核记录保存
  - 设计师账号体系
  - 历史案例库
  - 白名单图库校验
  - 后端图像特征检索
  - 法务复核工作流
