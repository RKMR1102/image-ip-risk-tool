# 图像侵权风险研判台

这是一个可部署到 `Vercel` 的前后端一体化骨架：

- 前端：上传两张图片、展示自动识别结果、运行风险规则
- 后端：`/api/analyze`
- 模型：通过 OpenAI 视觉能力识别品牌/IP、图案类型、元素差异和 AI 轮廓风险

## 目录

- `index.html`：页面结构
- `styles.css`：页面样式
- `app.js`：前端逻辑与规则引擎
- `api/analyze.js`：后端识别接口
- `package.json`：后端依赖
- `vercel.json`：Vercel 配置

## 自动识别能力

后端接口会返回这些字段：

- `patternType`：`single` / `composite`
- `brandRisk`：`yes` / `no`
- `brandOrIpNames`：命中的品牌或 IP 名称
- `elementDifferenceLevel`：`ge50` / `lt50`
- `visualDifference`：`yes` / `no`
- `mainElementDifferent`：`yes` / `no`
- `aiOutlineRisk`：`yes` / `no`
- `summary`：中文摘要
- `evidence`：识别依据

## 本地说明

直接双击 `index.html` 只能看静态页面，不能调用后端接口。

要完整运行，需要把它部署到 Vercel，或自己用 Node 跑一个后端服务。

## 部署到 Vercel

1. 把整个 `image-ip-risk-tool` 目录上传到 GitHub 仓库
2. 在 [Vercel](https://vercel.com/) 导入该仓库
3. 确认根目录就是当前目录
4. 在 Vercel 项目里打开 `Settings -> Environment Variables`
5. 添加：

```text
OPENAI_API_KEY=你的 OpenAI API Key
```

可选：

```text
OPENAI_VISION_MODEL=gpt-4.1-mini
```

6. 保存后重新部署

## 重新部署后如何生效

- GitHub 提交新文件后，Vercel 会自动重新部署
- 或者在 Vercel 的 `Deployments` 页面手动点 `Redeploy`

## 当前规则

- 品牌/IP元素：高风险
- AI保留原轮廓：高风险
- 整体视觉印象
  - 0项不同：高风险
  - 1项不同：高风险
  - 2项不同：中风险
  - 3项不同：低风险
- 单一图案
  - 主体没变且视觉接近：高风险
  - 主体没变但视觉不同：中风险
  - 主体变了且视觉不同：低风险
- 组合图案
  - 差异 < 50%：高风险
  - 差异 >= 50% 但视觉接近：中风险
  - 差异 >= 50% 且视觉不同：低风险

## 注意

- 当前后端是“自动初筛骨架”，不是最终法律判断系统
- 品牌/IP识别结果建议保留人工复核环节
- 如果后续要做正式系统，建议增加：
  - 审核日志
  - 用户权限
  - 历史案例库
  - 白名单图库
  - 结果存档
