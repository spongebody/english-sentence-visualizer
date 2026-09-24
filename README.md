# 句子研读

保留原句词序，用背景色突出主语、谓语、宾语、表语和补语。修饰连线、译文及表达词汇按需揭晓；支持嵌套从句、明显歧义切换与浏览器展示偏好。

线上入口：[英语句子成分工具](https://english-sentence-visualizer.vercel.app)。

## 本地运行

需要 Node.js 22 或更新版本。以下命令从知识库根目录执行：

```bash
cd Side_project/english-sentence-visualizer/code
./run.sh
```

脚本安装必要依赖、准备本地配置并提示访问入口。首次运行后，在本地 `.env` 填写 `DEEPSEEK_API_KEY`；默认模型为 `deepseek-flash`，可用 `DEEPSEEK_MODEL` 更改。配置后重新启动服务。凭证只在服务端读取。

单独拆出的工程仓库直接从工程根运行 `./run.sh`。默认端口 3000，可通过 `PORT` 覆盖。按 Ctrl+C 停止服务。

## 验证

以下命令均在工程根目录执行：

```bash
npm run typecheck
npm run build
node scripts/verify-api.mjs
```

最后一条需要已启动服务，会通过真实 API 验证八个句子并产生 DeepSeek 调用费用。可用 `VERIFY_URL` 指定线上地址，`VERIFY_CASE` 只验证某个样例，`VERIFY_OUTPUT` 将完整回包保存到指定文件。不要将私人阅读材料的回包作为公开产物上传。

按用户要求不使用 Playwright，不声称已经完成浏览器视觉或交互自动化验证。模型质量检查和类型、构建检查分别记录。

## 分析方式

- 页面提交原句，服务端生成准确的词元索引，再要求模型返回结构化分析。
- 所有范围采用词元索引的左闭右开区间，避免重复词定位错误。
- 主干核心与完整范围分别表示；倒装中的不连续谓语使用多个区间，不把中间主语包进谓语。
- 服务端校验范围、同层级成分冲突、层级引用和循环、修饰端点；校验不能证明语法绝对正确。
- 页面只渲染校验通过的数据；展开、开关、切换理解不再次调用模型。
- 本机只保存三个展示开关，不保存句子历史或 API Key。

## 发布

采用 Vercel 托管整个 Next.js 应用。在 Production 和 Preview 环境配置服务端 `DEEPSEEK_API_KEY` 与 `DEEPSEEK_MODEL`，不要使用 `NEXT_PUBLIC_` 前缀。

已连接公开仓库 [spongebody/english-sentence-visualizer](https://github.com/spongebody/english-sentence-visualizer)。推送 `main` 触发 Vercel 正式部署；其他分支或 PR 更新使用预览部署。环境变量在 Vercel 项目设置中维护，部署状态可在 GitHub 提交检查或 Vercel Deployments 查看。

需要手动部署时，在工程根执行 `npx vercel` 生成预览，`npx vercel --prod` 更新正式版本。

Vercel 连接的是拆出的独立工程仓库，Root Directory 使用仓库根目录。

MVP 不包含限流、每日配额、账户或用户自带 Key。输入长度与请求超时只用于保持分析和渲染可用，不是调用额度管理。
