# Engram · 沉浸式英语学习

> 让内容成为英语课。

Engram 是一款面向真实语境的英语学习助手，目标是把你本来就在看的视频、文章和网页内容，转化为可理解、可积累、可复习的个性化英语学习资料。

目前支持 YouTube 与 Paramount+ 视频学习：扩展从播放器的字幕轨、字幕 DOM 或网络字幕时间轴中获取英文字幕，使用 Chrome 本地 Translator API、DeepSeek 或 Google 翻译为简体中文，并提供难词提示、语境查词和生词积累。双语字幕是理解入口，而不是产品终点。

## 产品定位

- **核心理念：** 内容即教材，在真实兴趣和语境中习得英语
- **学习闭环：** 理解内容 → 注意表达 → 收藏生词 → 带语境复习
- **当前切入：** 把 YouTube、Paramount+ 视频字幕变成不中断观看体验的学习层
- **未来方向：** 支持更多视频站点与网页文字，并沉淀表达、知识卡片和个性化复习资料

## 当前能力 · 视频学习

- TextTrack `activeCues` 实时捕获
- YouTube 英文人工字幕优先、英文自动字幕兜底；无需先打开原生 CC
- YouTube JSON3 / timedtext、WebVTT / TTML 网络响应捕获和时间轴解析
- 可见字幕 DOM 兜底捕获
- Chrome 138+ 本地英译中；首次播放交互时自动准备语言包
- 可选 DeepSeek V4 Flash 高质量影视翻译，携带最近 4 句字幕消歧
- 可选 Google 网络翻译备用（需要在弹窗中主动选择）
- 双语、仅中文、仅英文三种显示模式
- 可选“高难词辅助”：在独立设置页按 B1 / B2 / C1 / C2 选择高亮等级，并在词下显示简短中文释义；默认仅高亮 C1、C2
- 全屏跟随、字幕字号/背景/位置设置
- 字幕块和运行状态块可直接拖动并记住位置；弹窗可恢复默认位置
- 鼠标悬停字幕时自动暂停并显示“上一句”按钮，移开后继续播放；`←` 快捷键可随时回看
- 英文逐词 hover：自动暂停视频，结合当前字幕与最近 4 句前文识别原形、短语和语境中文义，并可加入生词
- 单词本：搜索、排序、朗读、删除撤销、清空确认和 CSV 导出
- 调试页和本地视觉预览页
- YouTube 学习模式：从弹窗复制当前 YouTube 视频到新的学习标签页，保留左侧原生播放器，右侧提供 5 秒可读的材料分析、可跳转字幕，以及支持英语语音输入和自然朗读的 AI 讨论

### 学习模式

在已连接的 YouTube 视频上打开扩展弹窗，点击“打开学习模式”。扩展会新开一个带学习布局的 YouTube 页面，直接复用原生播放器，避免嵌入限制并保留账号、播放权限和 YouTube 控件。学习区读取当前视频的字幕时间轴，并默认展示：

- 材料与用户 CEFR 水平、适配结论和建议学习时长；
- 三个能够回到原字幕的高价值表达；
- 词汇、语速、句法难度与推荐精学区间；
- 可搜索、自动跟随和点击跳转的字幕列表；
- 基于材料与进阶迁移两种 AI 讨论，回答中的引用可回到视频时间点；
- Deepgram Flux 英语语音输入：识别结果先进入输入框供编辑，永不自动发送；
- Deepgram Aura-2 自然朗读：AI 新回复默认朗读，可关闭自动朗读，也可逐条重播。

材料分析和讨论通过自建代理调用 DeepSeek；语音由 Deepgram Flux 与 Aura-2 提供。永久 AK 都只保存在后端，扩展通过代理申请 30 秒短期语音令牌后直连 Deepgram，原始录音和朗读正文不经过 Engram 后端。模型只能返回固定结构，客户端和服务端都会验证表达与引用确实存在于字幕中。语音不可用时可完整使用现有文字讨论。可用 `learning-mode.html?preview=1` 在不加载扩展 API、不开启后端、无需麦克风权限的情况下预览完整语音交互状态。

## 安装

1. 打开 `chrome://extensions/`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本目录。
5. 打开 YouTube 或 Paramount+ 播放页面。

在 YouTube 上，插件会优先读取视频自带的英文人工字幕，缺少人工字幕时使用英文自动字幕，因此通常无需手动打开 YouTube 的 CC；拿不到字幕轨地址时，会回退捕获已显示的原生字幕。在 Paramount+ 上，插件会把英文字幕轨设为浏览器的隐藏模式：字幕数据继续加载，但网站原生字幕不会绘制。关闭插件后会恢复页面原来的字幕开关状态。

## 首次翻译

默认使用 Chrome 本地 Translator API。已下载语言包时会直接翻译；首次需要下载时，Chrome 要求一次用户激活，插件会借用你正常的播放点击或键盘操作自动准备语言包，不再要求单独点击提示。下载完成后字幕不会发送到远程服务器。

右上角运行状态块用于排查字幕捕获和翻译链路，默认关闭，避免遮挡视频。需要时可在插件弹窗中开启“显示运行状态”；状态块可拖动，也可单击隐藏。字幕块也可拖动，双击字幕背景或点击弹窗中的“恢复字幕与状态块默认位置”可以复位。

也可以在弹窗中把翻译引擎切换为“Google 备用”。该模式会把当前字幕文本发送到 Google Translate 非正式网页接口，仅建议个人临时使用。

### DeepSeek 高质量翻译

DeepSeek API Key 不应出现在扩展源码、打包文件或浏览器设置中：这些内容都可以被用户解包或通过开发者工具检查。扩展因此只调用自建翻译代理，DeepSeek API Key 仅由后端环境变量 `DEEPSEEK_API_KEY` 提供。

DeepSeek 模式使用 `deepseek-v4-flash`，关闭深度思考以降低延迟。每次会发送当前字幕和最近 4 句英文前文，用于判断代词、人物关系和口语语气，但只返回当前句译文。相同字幕与上下文的译文会在本地缓存。LLM 调用仍可能有几百毫秒到数秒的网络和生成延迟，服务繁忙时可能更久。

悬停查词复用同一后端：扩展发送固定的 `{ word, sentence, context }`，服务返回结构化的原形、语境短语、词性和中英文释义；音标仍由 Dictionary API 补充。自动高难词提示继续走轻量词典链路，只有用户明确悬停某个单词时才调用语境模型。

#### 启动本地代理

复制仓库内提供的示例配置，创建仅供本机使用的 `server/.env.local`：

```bash
cp server/.env.example server/.env.local
chmod 600 server/.env.local
```

编辑这个文件：

```dotenv
DEEPSEEK_API_KEY=你的DeepSeek_API_Key
DEEPGRAM_API_KEY=你的Deepgram_API_Key
HOST=127.0.0.1
PORT=8787
```

`DEEPGRAM_API_KEY` 同时用于 Flux 语音识别和 Aura-2 朗读。首次点击讨论区麦克风时，页面会说明音频将发送到 Deepgram 并请求同意；Chrome 随后才会申请麦克风权限。识别文字仍需由用户手动发送。

然后启动：

```bash
npm start
```

`npm start` 是一次性启动，不会监听代码变化。只开发后端时请改用：

```bash
npm run dev:server
```

该命令会在 `server/*.mjs` 发生变化时自动重启代理。这里是自动重启进程，不是保留进程内状态的 HMR；对当前无状态 HTTP 代理效果等同于热更新。

#### Chrome 扩展自动重载开发

只开发扩展时运行：

```bash
npm run dev:extension
```

第一次运行后，在 `chrome://extensions/` 开启开发者模式，点击“加载已解压的扩展程序”，选择 `dist/extension/`。如果此前加载的是仓库根目录，请先停用或移除那一份，避免两份扩展同时向页面注入内容脚本；目录变化也会让未固定 key 的已解压扩展获得不同 ID，因此配置过 `ALLOWED_ORIGINS` 时要同步更新其中的扩展 ID。之后修改扩展白名单内的 JS、CSS、HTML、manifest、图标或本地化文件时，开发脚本会自动重建产物，调用 Chrome 的扩展重载能力，并刷新已经打开的 YouTube / Paramount+ 页面以及 dashboard、debug、设置等扩展页面，不需要再手动点击扩展卡片上的刷新按钮。开发重载服务只监听 `127.0.0.1:8790`；如果端口冲突，可通过 `ENGRAM_EXTENSION_RELOAD_PORT` 指定其他端口后重新加载一次 `dist/extension/`。

同时开发后端和扩展时直接运行：

```bash
npm run dev
```

这会同时启动后端监听和扩展自动重载。Chrome 仍要求第一次手动加载开发目录；扩展 service worker 或 manifest 变化会完整重载扩展，内容脚本变化还会刷新目标视频页，因此这属于 live reload，并不保留页面内的运行状态。`npm run build:extension` 生成的发布产物不会包含开发重载脚本或额外的本机端口权限。

`server/.env.local` 已被 Git 忽略，`server/.env.example` 会随代码提交，方便其他开发者快速开始。如需使用其他路径，可执行 `npm --prefix server run start:local -- /绝对路径/server.env`，或设置 `ENGRAM_SERVER_ENV_FILE`（旧的 `PST_SERVER_ENV_FILE` 仍兼容）。启动脚本不会执行 env 文件中的 shell 内容，只接受服务所需的变量，并会拒绝可被其他本机用户读取的配置文件。

真实 AK 只能写入已忽略的 `server/.env.local`，不要写入 `.env.example`、源码或任何提交到 Git 的文件。服务默认只监听 `127.0.0.1:8787`，扩展默认调用：

- `POST /v1/translate`：字幕翻译
- `POST /v1/word-lookup`：结合字幕语境查词
- `POST /v1/voice/token`：签发 30 秒 Deepgram 临时令牌，不接收音频或朗读正文
- `GET /health`：健康检查

服务不接受来自扩展的模型名、system prompt 或生成参数，且内置字幕长度、请求体、并发和每分钟速率限制，避免成为任意 LLM 转发器。

#### 构建 Chrome 扩展发布产物

不要直接把整个仓库交给 Chrome 打包；`.gitignore` 不控制扩展包内容。使用白名单构建：

```bash
npm run build:extension
```

产物位于 `dist/extension/`，只包含扩展运行所需文件，不包含 `server/`、测试、文档或任何 env 文件。开发者模式应加载该目录；发布到 Chrome Web Store 时也只压缩该目录中的内容。

#### 部署到公网

仓库已包含 Cloudflare Worker 入口、Wrangler 配置和 GitHub Actions 流水线。首次部署前，先在 Cloudflare Dashboard 的 Workers & Pages 引导页创建你的 `workers.dev` 子域；这一步需要交互确认，GitHub Actions 无法代办。已有 `workers.dev` 子域或改用自定义域名/route 的账号可以跳过。

然后在 GitHub 仓库的 `Settings → Secrets and variables → Actions` 中创建四个 Repository Secret：

- `CLOUDFLARE_API_TOKEN`：使用 Cloudflare 的 **Edit Cloudflare Workers** 模板创建，并只授权目标账号
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账号 ID
- `DEEPSEEK_API_KEY`：生产环境使用的 DeepSeek AK
- `DEEPGRAM_API_KEY`：生产环境使用的 Deepgram AK

推送 `server/**` 或部署工作流到 `main` 后，流水线会先运行扩展和后端测试，再部署 `paramount-subtitle-translation-proxy` Worker，并把两个 AK 写入 Cloudflare Worker Secret。也可以从 GitHub Actions 页面手动运行。AK 不会写进源码、Wrangler 明文变量或构建产物。

Worker 使用 Cloudflare Rate Limiting binding 按客户端和路由限制请求；Node 服务内的并发和速率限制仍作为第二层保护。`server/wrangler.jsonc` 中的 `namespace_id` 必须在你的 Cloudflare 账号内唯一，如已被其他 Worker 使用，请先改成另一个正整数。

如果需要限制扩展来源，可在 Cloudflare Worker 设置中增加文本变量：

```dotenv
ALLOWED_ORIGINS=chrome-extension://你的扩展ID
RATE_LIMIT_PER_MINUTE=120
VOICE_TOKEN_RATE_LIMIT_PER_MINUTE=12
MAX_CONCURRENCY=8
```

`server/Dockerfile` 仍可用于其他容器平台。无论使用哪种部署方式，公网必须启用 HTTPS。部署完成后，在 `chrome.storage.local.translationProxyUrl` 中配置 Worker 地址，并把 [manifest.json](./manifest.json) 中的本机 host permission 改为你的确切 HTTPS 域名。代理 URL 本身不是秘密；如果扩展面向多人公开发布，还应增加用户登录、短期令牌或网关鉴权，否则他人仍可能直接调用公开代理并消耗额度。

## 调试

弹窗底部点击“打开调试信息”，可以查看：

- 捕获来源：TextTrack / DOM / WebVTT / TTML
- 最近英文和中文字幕
- 本地翻译模型状态
- 采集器事件日志
- 一键模拟字幕

`preview.html` 是不依赖视频站点登录态的视觉预览页，可通过本地 HTTP 服务打开。

## 已知限制

- YouTube 无英文人工字幕或英文自动字幕的视频无法生成英文双语字幕；若播放器没有暴露字幕轨，可先打开原生英文 CC 触发 DOM 捕获兜底。
- Paramount+ 不同地区或播放器版本可能使用不同字幕链路；第一次在真实账号上运行后，可能需要根据调试日志微调请求识别规则或 DOM 选择器。
- 网络字幕如果使用特殊 MPEG-TS 时间基准，当前解析器可能不能直接对齐，但 TextTrack/DOM 路线仍可工作。
- Dictionary API 只负责音标和基础英文词典数据；语境词义依赖自建后端，后端不可用时会降级为孤立单词翻译，准确率可能降低。
- 这是个人学习工具，不下载视频，也不绕过 DRM。

## 项目结构

```text
manifest.json              Chrome 扩展清单
popup.*                    设置弹窗
debug.*                    运行诊断页
vocabulary.*               单词本管理页
learning-settings.*        高难词等级设置页
preview.*                  本地视觉/交互预览
src/page-bridge.js         页面主环境：YouTube 字幕轨、fetch/XHR/TextTrack 捕获
src/capture.js             DOM/JSON3/timedtext/VTT/TTML 解析与采集协调
src/learning-site-adapters.js  学习模式站点注册表：路由、元数据、播放器定位与原站链接
src/learning-workspace-shell.js 通用学习工作区：播放器控制、字幕、生词与右侧分析面板
src/discussion-stt.js      Deepgram Flux 流式英语识别与麦克风生命周期
src/discussion-tts.js      Deepgram Aura-2 流式播放、取消和内存缓存
src/translator.js          Chrome 本地、DeepSeek 与 Google 备用翻译
src/overlay.js             Shadow DOM 双语字幕和词卡
src/service-worker.js      翻译代理、语境查词、语音临时令牌、Google 备用和词典请求
server/                    从环境变量读取 DeepSeek / Deepgram AK 的 Node / Cloudflare 后端
.github/workflows/         测试并自动部署 Cloudflare Worker
```
