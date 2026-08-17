# Engram 材料学习适合性评估 Spec

> 状态：Proposal，待产品评审  
> 日期：2026-08-17  
> 范围：仅定义产品与技术协议，本阶段不开发  
> 关联文档：[学习模式产品与交互 Spec](./learning-mode-spec.md)

## 1. 背景与问题

当前“材料分析”默认假设每个视频都值得学，再要求 AI 给出“你能学到什么”、5–8 个学习项和讨论问题。这会产生一个结构性偏差：即使字幕主要是零散指令、环境音、重复语句或片尾内容，系统仍会努力包装出一堂完整课程。

截图中的驾驶舱视频就是典型风险：视频本身可能有观看价值，但如果英文字幕碎、连续语境少、可迁移表达有限，它就不一定适合拿来学英语。此时继续展示完整的“你能学到什么”，会让用户误以为材料质量已经通过判断。

本能力要先回答：

> **根据当前可获得的英文字幕，这份材料值不值得我花时间学；如果不适合，我接下来应该怎么做？**

这里判断的是“作为英语学习材料的适合性”，不是视频是否好看、事实是否正确、画面是否有知识量。

## 2. 产品决策

材料分析先分别判断两个内部结论，再综合成一个用户结论：

1. **材料学习价值**：仅判断材料本身是否值得反复精学、只适合泛看或不适合作为学习材料；
2. **难度匹配**：单独判断材料难度相对当前用户 CEFR 水平是偏简单、匹配还是偏难；
3. **综合建议**：把前两项按固定矩阵合并，最终只向用户展示“推荐精学 / 建议泛看 / 不推荐”中的一个结论。

两项内部判断彼此独立，但都会影响综合建议。一份高质量 C1 材料对 B1 用户，材料本身可以“值得精学”，但因为“偏难”，最终应为“不推荐”；一份高质量 A1 材料对 B2 用户，材料本身仍可“值得精学”，但因为“偏简单”，最终应为“建议泛看”。

只有综合建议为“推荐精学”时，才生成完整学习重点和讨论；“建议泛看”只提供轻量提示；“不推荐”不生成课程。

首版默认按“通用英语学习”判断。航空通话、游戏术语等高度专业内容，不能因为含有专业词就自动视为高学习价值；未来有明确学习目标后，再允许目标改变推荐结果。

## 3. 目标与非目标

### 目标

- 用户进入材料分析后 5 秒内看到明确、可行动的结论；
- 识别“字幕存在但不构成好教材”的情况；
- 避免为了满足固定数量而硬凑学习项、片段和问题；
- 对不值得完整精学、但局部仍有价值的材料，在“泛看”结论下提示可留意片段；
- 解释结论的主要原因，让用户知道系统不是只按视频长短或 CEFR 打分；
- 评估失败或字幕未收集完成时统一降级为“不推荐”，同时说明具体兜底原因并允许重试。

### 非目标

- 判断视频内容是否真实、优质或符合用户兴趣；
- 仅凭字幕判断音质、口音清晰度、画面教学价值或说话人身份；
- 给出 0–100 的伪精确综合分；
- 首版询问职业、考试、航空英语等细分学习目标；
- 自动删除、关闭或阻止用户继续观看视频。

## 4. 三层结论模型

### 4.1 材料学习价值（内部结论）

| `materialVerdict` | 产品含义 | 判断依据 |
| --- | --- | --- |
| `worth_intensive_study` | 值得精学 | 材料有连续语境、足够信息密度和可迁移表达，值得慢慢反复学习 |
| `viewing_only` | 仅适合泛看 | 材料可以接触英语，但语言密度、连续性或可迁移表达不足以支撑完整精学 |
| `not_suitable` | 不适合作为学习材料 | 字幕过碎、过少、重复、以非语言内容为主，或分析证据不足 |

该结论只基于当前字幕版本和评估版本，与用户水平无关。

### 4.2 难度匹配（内部结论）

| `difficultyFit` | 产品含义 | 判断依据 |
| --- | --- | --- |
| `too_easy` | 偏简单 | 大部分语言明显低于当前水平，精学新增收益低 |
| `matched` | 匹配 | 与当前水平接近或略高，但大体可理解；“略有挑战”归入匹配 |
| `too_hard` | 偏难 | 大部分内容明显超出当前水平，精学成本过高 |
| `unknown` | 无结论 | 材料证据不足，无法可靠比较 |

### 4.3 综合建议（唯一用户结论）

用户只看到以下一个结论，不同时展示“材料价值”和“难度匹配”两个结论标签：

| `finalRecommendation` | 用户文案 | 主操作 |
| --- | --- | --- |
| `intensive_study` | 推荐精学 | 开始学习 |
| `extensive_viewing` | 建议泛看 | 继续观看 |
| `not_recommended` | 不推荐 | 换材料或重试 |

固定决策矩阵：

| 材料学习价值 \ 难度匹配 | 偏简单 | 匹配 | 偏难 | 无结论 |
| --- | --- | --- | --- | --- |
| 值得精学 | 建议泛看 | 推荐精学 | 不推荐 | 不推荐 |
| 仅适合泛看 | 建议泛看 | 建议泛看 | 不推荐 | 不推荐 |
| 不适合作为学习材料 | 不推荐 | 不推荐 | 不推荐 | 不推荐 |

`assessmentStatus` 可以在内部区分评估完成、字幕未完成和服务失败，但不能形成第四种用户结论；非完成状态的综合建议一律为 `not_recommended`。

综合建议的解释文案可以提及两个内部判断，例如“材料本身值得精学，但对你偏简单”，但不能再显示第二、第三个结论徽标。

### 用户文案原则

- 先说建议，再说原因，不先展示模型分析过程；
- 原因最多显示两条，必须具体，例如“字幕大多是零散通话，缺少连续语境”；
- 不使用“低质量视频”“没有价值”等对内容本身带贬义的文案；
- 不承诺无法从字幕验证的事实，例如“音质很差”“说话不清楚”；
- `not_recommended` 状态不再显示正向的“你能学到什么”。

## 5. 评估模型

### 5.1 证据充分性

先判断能不能下结论：

- `transcriptComplete = false` 时显示 `not_recommended`，原因为“字幕仍在收集”，内部状态为 `pending`，且不缓存为最终结论；
- 字幕抓取完成但英文文本极少，属于“有证据证明语言材料不足”，显示 `not_recommended`，内部状态为 `complete`；
- AI 或服务异常时显示 `not_recommended`，内部状态为 `failed`，不能用本地难度启发式伪装成完整适合性判断；
- 评估文案必须注明依据是当前英文字幕，不把字幕诊断扩大为对视频整体的判断。

### 5.2 材料可学性

材料可学性输出为 `strong | segmental | weak | unknown`，由以下四个维度共同决定：

| 维度 | 要回答的问题 | 主要信号 |
| --- | --- | --- |
| 字幕可用性 | 有多少是真正可分析的英文？ | 有效词数、每分钟有效词数、非语言标记占比、重复占比、字幕覆盖状态 |
| 语境连续性 | 句子能否组成可理解的连续表达？ | 重组后的碎片率、连续语义单元长度、合格片段数量与时长 |
| 可学习信息密度 | 内容是否持续表达动作、关系、观点、解释或叙事？ | 纯口令/标签/填充语占比、语义推进、上下文依赖程度 |
| 可迁移语言产出 | 能否找到离开视频后仍值得复用的语言？ | 经字幕校验的高价值表达数量、类别多样性、是否只剩专名或专业缩写 |

“字幕碎”不能直接按原始 cue 长度判断。YouTube 自动字幕经常把一个完整句子切成多条 cue，因此必须先做重组再评估。

### 5.3 难度匹配

难度匹配输出为：

- `too_easy`：整体低于用户至少一个主要 CEFR 档，且高价值新表达很少；
- `matched`：主要内容与用户水平相近或略高，但存在足够支架且大体可理解；
- `too_hard`：大部分连续内容明显超出当前水平；
- `unknown`：材料可学性不足，或没有足够文本估算难度。

材料为 `weak` 时，难度匹配必须为 `unknown`，不能给一段不可学字幕贴上看似精确的 B1/B2 结论。难度匹配不改变材料学习价值，但必须参与最终综合建议。

## 6. 字幕预处理与可解释信号

服务端在调用语义模型前先生成确定性诊断：

1. 按时间排序并清理空白；
2. 去除滚动字幕造成的重叠重复词，不删除真实重复表达；
3. 标记 `[Music]`、`[Applause]`、纯人名标签、时间码等非语言 cue；
4. 将间隔不超过 1.2 秒、语法上未结束的相邻 cue 重组成分析单元；单元最长不超过 12 秒或 45 个英文词；
5. 再按时间和语义连续性形成候选学习片段；
6. 所有比例均基于清理后的单元计算，同时保留原始 cue 以便时间戳跳转。

首版至少记录以下内部信号：

```json
{
  "transcriptComplete": true,
  "usableWordCount": 126,
  "usableWordsPerMinute": 13.8,
  "nonSpeechRatio": 0.31,
  "repetitionRatio": 0.24,
  "fragmentRatio": 0.68,
  "coherentSpanCount": 0,
  "coherentSpanSeconds": 0,
  "groundedLearningItemCount": 2
}
```

这些数字用于判定、调试和离线校准，首版默认不直接显示给用户。用户看到的是由固定 reason code 映射出的自然语言原因。

### 初始判定规则

阈值是首版可调参数，不写死在提示词中。实现前应使用真实视频样本离线校准。

- 完整字幕在动态最低英文量以下，且没有一个 20 秒以上的合格片段：`weak`；
- 非语言内容或去重后重复内容占大多数，且没有合格片段：`weak`；
- 重组后碎片率高、语义密度低、可迁移表达少三项中至少两项为低，且没有合格片段：`weak`；
- 整体不稳定，但存在至少一个 30 秒以上、包含至少 2 个经字幕校验学习项的片段：`segmental`；
- 整体存在持续语义推进，并能自然选出至少 5 个经字幕校验的高价值学习项：`strong`；
- 短视频不因时长短自动失败。清晰、完整、信息集中的 20–60 秒内容可以是 `segmental` 或 `strong`；
- 高度专业且主要由缩写、呼号、专名和短口令组成的内容，按通用英语目标降低“可迁移语言产出”，但不能仅因题材专业直接判失败。

材料学习价值只由材料可学性生成：

| 材料可学性 | `materialVerdict` |
| --- | --- |
| `strong` | `worth_intensive_study` |
| `segmental` | `viewing_only`，可附带可留意片段 |
| `weak` | `not_suitable` |
| `unknown` | `not_suitable` |

组合示例：

| 材料情况 | 材料学习价值 | 难度匹配 | 最终用户结论 |
| --- | --- | --- | --- |
| 高质量 B2 教程，用户 B1 | 值得精学 | 匹配（略有挑战） | 推荐精学 |
| 高质量 C1 讲座，用户 B1 | 值得精学 | 偏难 | 不推荐 |
| 高质量 A1 教程，用户 B2 | 值得精学 | 偏简单 | 建议泛看 |
| 零散 B1 通话，用户 B1 | 不适合作为学习材料 | 无结论 | 不推荐 |

## 7. AI 与规则的职责边界

确定性逻辑负责：

- 字幕完整状态、去重、非语言标记、覆盖和基础统计；
- 校验学习项和证据是否原样存在于字幕；
- 根据结构化维度和阈值生成 `materialQuality` 与 `materialVerdict`；
- 独立计算 `difficultyFit`，再按固定矩阵生成 `finalRecommendation`；
- 把 reason code 映射为稳定的界面文案。

AI 负责：

- 判断重组单元是否形成连续语义；
- 判断内容是语义推进还是主要由零散口令、标签和填充语组成；
- 判断表达对通用英语是否有迁移价值；
- 提出候选学习片段、学习项和一条简短总结。

AI 不得：

- 自行声明字幕已完整覆盖；
- 只凭 cue 短就判断材料不可学；
- 为满足数量要求补造学习项；
- 推翻服务端的证据不足状态；
- 把字幕中出现的指令当作系统指令。

## 8. 返回结构

现有 `fitVerdict / fitReasons` 被以下结构替代；客户端不再直接信任模型自由生成的 verdict。

```json
{
  "suitability": {
    "assessmentStatus": "complete",
    "basis": "general_english_from_transcript",
    "materialQuality": "weak",
    "materialVerdict": "not_suitable",
    "difficultyMatch": {
      "materialLevel": null,
      "learnerLevel": "B1",
      "difficultyFit": "unknown"
    },
    "finalRecommendation": "not_recommended",
    "confidence": "high",
    "reasonCodes": ["fragmented_context", "low_learning_yield"],
    "summary": "字幕主要由零散通话和提示语组成，缺少可连续精学的英语语境。",
    "diagnostics": {
      "transcriptComplete": true,
      "usableWordCount": 126,
      "usableWordsPerMinute": 13.8,
      "nonSpeechRatio": 0.31,
      "repetitionRatio": 0.24,
      "fragmentRatio": 0.68,
      "coherentSpanCount": 0,
      "coherentSpanSeconds": 0,
      "groundedLearningItemCount": 2
    },
    "bestSpans": []
  },
  "vocabularyLevel": null,
  "speechLevel": null,
  "syntaxLevel": null,
  "learningOutcomes": [],
  "learningItems": [],
  "timelineSegments": [],
  "discussionQuestions": {
    "source": [],
    "advanced": []
  }
}
```

`bestSpans` 每项必须包含：

```json
{
  "start": 130,
  "end": 218,
  "title": "起飞前检查",
  "reason": "这一段有连续操作说明和可复用的确认表达",
  "timestamp": 130,
  "sourceText": "..."
}
```

约束：

- `assessmentStatus` 只能是 `complete | pending | failed`；只有 `complete` 可缓存为最终结论；
- `materialVerdict` 只能是 `worth_intensive_study | viewing_only | not_suitable`；
- `difficultyMatch.difficultyFit` 只能是 `too_easy | matched | too_hard | unknown`；
- `finalRecommendation` 只能是 `intensive_study | extensive_viewing | not_recommended`，并且必须严格符合决策矩阵；
- `pending` 和 `failed` 状态必须返回 `materialVerdict = not_suitable`、`difficultyFit = unknown`、`finalRecommendation = not_recommended`；
- `reasonCodes` 最多 3 个，界面首屏最多展示 2 个；
- `summary` 必须是简体中文，最多 80 个汉字，且不得包含字幕之外的音质、画面或事实判断；
- `confidence` 只用于降级和调试，首版不展示百分比；
- `finalRecommendation = intensive_study` 返回 5–8 个学习项，并可生成完整讨论课；
- `finalRecommendation = extensive_viewing` 可返回 0–4 个可选表达和 0–3 个可留意片段，但不生成完整讨论课；
- `finalRecommendation = not_recommended` 的学习收获、学习项、片段和讨论问题必须为空；
- 所有学习项、片段与讨论证据继续执行现有字幕原文和时间戳校验；
- 字段非法或相互矛盾时，客户端降级为 `materialVerdict = not_suitable`、`difficultyFit = unknown`、`finalRecommendation = not_recommended`，内部状态记为 `failed`。

建议的首批 reason code：

- `transcript_incomplete`：字幕仍在收集；
- `analysis_unavailable`：当前无法完成可靠分析；
- `too_little_english`：可学习的英文内容很少；
- `mostly_non_speech`：字幕主要是音乐、提示或非语言内容；
- `highly_repetitive`：有效内容重复较多；
- `fragmented_context`：字幕很零散，缺少连续语境；
- `low_semantic_density`：有效信息推进较少；
- `low_learning_yield`：可迁移表达有限；
- `specialized_terse_language`：内容主要是专业缩写或短口令；
- `strong_coherent_spans`：存在连续且有上下文的学习片段；
- `useful_transferable_language`：包含足够可复用表达；
- `level_too_easy / level_matched / level_too_hard`：用户水平匹配原因。

## 9. 页面与交互

### 9.1 首屏位置

综合建议取代当前“你能学到什么”的绝对首位，放在材料分析 Tab 顶部。1440×900 下无需滚动即可看到：

1. 唯一的综合建议；
2. 一句话解释和最多两条原因；
3. 主操作；
4. 通过评估时的第一个学习收获或推荐片段。

材料学习价值和难度匹配不作为两个并列结论展示，只用于生成综合建议及其解释。

### 9.2 各状态布局

`intensive_study`

- 标题显示“推荐精学”；
- 示例说明：“这份材料值得精学，难度与你匹配，并且保留了适当挑战。”；
- 下方继续显示当前“你能学到什么”、难度、学习重点和推荐片段；
- “开始学习”定位到首个推荐项。

`extensive_viewing`

- 标题显示“建议泛看”；
- 因难度偏简单时，示例说明：“材料本身有学习价值，但对你偏简单，不必投入时间反复精学。”；
- 因材料只适合泛看时，示例说明：“这份材料可以作为英语输入，但语言内容较稀疏，不值得完整精学。”；
- 主操作为“继续观看”，可选显示少量表达；
- 如果存在局部高价值内容，可展示 1–3 个可跳转的“可留意片段”，但不升级为独立结论；
- 默认不生成完整讨论课。

`not_recommended`

- 标题统一为“不推荐”；
- 因材料本身不足时，示例说明：“字幕主要是零散通话，缺少连续语境，可复用表达也很少。”；
- 因难度偏高时，示例说明：“材料本身有学习价值，但目前对你偏难，精学成本过高。”；
- 字幕或服务兜底的示例说明：“字幕仍在收集，当前不推荐生成课程”或“分析未完成，当前不推荐使用这份材料学习”；
- 完整评估为不推荐时，主操作为“返回选其他视频”；兜底状态主操作为“重试”；次操作均可为“仍然查看字幕”；
- 隐藏“你能学到什么”、CEFR 难度条、学习重点和推荐片段；
- 讨论 Tab 保留但禁用开始按钮，说明“这份字幕不足以生成可靠讨论课”。
- 内部状态为 `pending` 时，字幕完整后自动重新评估；内部状态为 `failed` 时允许重试；两者都不显示暂定的正向学习收获。

### 9.3 水平切换与刷新

- 用户切换 CEFR 时，重新计算 `difficultyFit` 和 `finalRecommendation`；字幕质量、材料可学性与 `materialVerdict` 保持不变；
- 用户主动刷新时重新获取当前完整字幕，并绕过该字幕版本的结果缓存；
- 字幕 hash 变化后旧结论失效；
- 若 `materialVerdict = not_suitable`，切换用户水平不能把综合建议变成 `intensive_study` 或 `extensive_viewing`。

## 10. 生成与缓存流程

1. 获取完整字幕并完成重组、去重和确定性诊断；
2. 若字幕未完成，返回 `materialVerdict = not_suitable`、`difficultyFit = unknown`、`finalRecommendation = not_recommended` 和 `assessmentStatus = pending`；
3. 语义评估材料可学性，允许返回 0 个学习项；
4. 服务端校验证据并生成 `materialQuality` 与 `materialVerdict`；
5. 独立结合用户水平生成 `difficultyFit`；
6. 按固定矩阵生成唯一的 `finalRecommendation`；
7. 只有 `finalRecommendation = intensive_study` 进入完整课程生成；`extensive_viewing` 最多生成少量表达和可留意片段；
8. 客户端校验状态与下游数据的一致性后渲染。

缓存拆分：

- 材料可学性与材料学习价值：`videoId + transcriptHash + suitabilityVersion`，与用户水平无关；
- 难度匹配：在上一个键后增加 `learnerLevel`；
- 综合建议：由缓存的材料学习价值和难度匹配即时计算，不单独作为真相来源；
- 课程内容：继续增加课程生成版本和推荐片段范围；
- 首版最多缓存 20 个视频，沿用现有本地缓存上限。

## 11. 失败与边界情况

- **视觉信息丰富但语言很少**：可以是好视频，但应明确“不适合作为英语精学材料”；
- **自动字幕 cue 很碎但可重组为完整句**：不能误判，按重组后的单元评估；
- **短而密集的视频**：不因时长短失败；完整且有语境时可推荐；
- **专业通话**：若主要是呼号、数字、缩写和短口令，通用英语价值偏低；若存在连续解释片段，可根据整体质量归入“泛看”或“适合精学”；
- **材料对用户太难**：材料学习价值仍可为“值得精学”，但综合建议为“不推荐”；解释说明当前难度不匹配；
- **材料对用户太简单**：材料学习价值仍可为“值得精学”，但综合建议为“建议泛看”；不为了凑课强行提取冷僻词；
- **字幕收集中**：对外显示“不推荐”，内部状态为 `pending`，不得根据前几十秒形成正向结论；
- **AI 不可用**：对外显示“不推荐”，内部状态为 `failed`；可展示确定性字幕诊断，但不能生成课程；
- **用户仍想继续**：允许看视频和字幕，但不生成未经证据支持的完整课程。

## 12. 验收场景

至少用以下固定样本验证，不能只测“正常教程视频”：

1. **驾驶舱/ATC 类视频**：9 分钟，字幕以零散通话、数字、呼号和片尾内容为主，无合格连续片段；预期 `materialVerdict = not_suitable`、`finalRecommendation = not_recommended`，学习项和讨论问题为空；
2. **碎 cue、完整句**：自动字幕把每句话切成多个 1–3 词 cue，但重组后是连续访谈；预期不能因原始 cue 短而判失败；
3. **标准教程**：10 分钟，有连续解释、例子和至少 5 个可迁移表达，难度略高但大体可理解；预期 `materialVerdict = worth_intensive_study`、`difficultyFit = matched`、`finalRecommendation = intensive_study`；
4. **局部高价值**：20 分钟中只有两个 60–90 秒片段有连续讲解，难度匹配；预期 `materialVerdict = viewing_only`、`finalRecommendation = extensive_viewing`，可显示可留意片段但不生成完整课程；
5. **材料对用户偏简单**：高质量、连贯的 A1 教程面对 B2 用户；预期 `materialVerdict = worth_intensive_study`、`difficultyFit = too_easy`、`finalRecommendation = extensive_viewing`；
6. **材料对用户偏难**：高质量、连贯的 C1 讲座面对 B1 用户；预期 `materialVerdict = worth_intensive_study`、`difficultyFit = too_hard`、`finalRecommendation = not_recommended`；
7. **短视频**：45 秒、约 70 个有效词、语境完整；材料学习价值不能按时长直接判低，最终建议再结合难度匹配；
8. **字幕未完成**：只捕获前 30%；预期 `materialVerdict = not_suitable`、`difficultyFit = unknown`、`finalRecommendation = not_recommended`、`assessmentStatus = pending`，不得缓存最终结论；
9. **音乐和环境音**：完整字幕主要为 `[Music]`、`[Applause]`；预期 `materialVerdict = not_suitable`、`finalRecommendation = not_recommended`；
10. **分析服务失败**：预期 `materialVerdict = not_suitable`、`difficultyFit = unknown`、`finalRecommendation = not_recommended`、`assessmentStatus = failed`，字幕功能正常，不展示伪造学习收获。

## 13. 成功指标

首版上线前以离线标注和可用性测试为主，不追求单一“准确率”：

- 人工认为“不适合作为学习材料”的样本中，系统仍判为 `worth_intensive_study` 的比例低于 10%；
- 人工认为“适合”的样本中，因原始 cue 碎而误拒的比例低于 10%；
- 推荐片段中的学习项 100% 能定位到片段内原字幕；
- `finalRecommendation = not_recommended` 时不生成学习项或讨论问题；
- 首屏只显示一个综合建议，不出现材料价值和难度匹配两个并列结论；
- 80% 以上测试用户能在 5 秒内回答“系统最终建议我精学、泛看还是换材料”；
- 收集“建议有帮助 / 判断不准”的轻量反馈，用于调整阈值，但不上传完整字幕或对话内容。

## 14. 待产品评审问题

1. `not_recommended` 是否需要提供“仍用这份材料生成课程”的强制覆盖入口；本 spec 建议首版不提供，只保留观看与字幕。
2. `extensive_viewing` 是否应保留 1–2 个表达卡；本 spec 建议可以有，但不生成完整讨论课。
3. 未来加入学习目标后，是否允许“航空英语”等目标把专业短口令材料从 `weak` 提升为 `segmental`；首版不处理。
