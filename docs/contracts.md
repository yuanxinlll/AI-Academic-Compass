# Academic Compass — 数据与接口约定（contracts.md）

> 依据：SanD 规划文档 3.3 / 5.3 / 5.4 / 7.3。文档已定的内容不改，本文件只把字段统一、补齐类型与格式。
> 负责人：D（Backend & Integration）。**本文件是团队最终协议**。改字段名前先在群里说；新增字段可以直接加，但要同步更新本文件。
>
> **v1.1 变更（2026-11-14）**：明确两个状态枚举的区别（§1）、空数组含义（§0）、资格汇总规则加入 verified 门槛（§4.4）、`relevance_score` 可为 null（§4.4）、简历上限改为 4MB（§4.3）、新增 Python 服务部署与接口归属（§8）。数据库字段不变。

---

## 0. 通用约定

| 规则 | 说明 |
|---|---|
| 命名 | JSON 字段和数据库列一律 `snake_case` |
| 时间戳 | ISO 8601 UTC，如 `2026-11-14T19:00:00Z`（数据库用 `timestamptz`） |
| 日期 | `YYYY-MM-DD`，如 `2026-12-01` |
| 未知值 | 单值字段用 `null`；**不要**用 `""`、`"N/A"`、`"unknown"`。AI 不得猜测填充 |
| 数组 | 一律不用 `null`，最少为 `[]`（数据库列均为 `NOT NULL DEFAULT '{}'`/`'[]'`）。**`[]` 只表示"没有提取到/没有提供"，不表示"确定没有"**，见下方说明 |

**`[]` 的含义（v1.1）**
- **机会侧**（`required_skills`、`eligibility`）：`[]` = 没有提取到要求。只有当该机会 `status = "verified"` 时，才可以把它的 `eligibility` 视为**完整列表**（此时 `[]` 才等于"没有硬性要求"）。
- **学生侧**（`skills`、`interests`、`courses_taken` 等）：`[]` = 学生没有填写，按**未知**处理，不能推断为"没有这项技能"。匹配时该维度不参与计算。
- **标量**（如 `hours_per_week`、`deadline`）：`null` = 未知。
| ID | `uuid`（数据库 `gen_random_uuid()` 生成） |
| 错误返回 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` + 对应 HTTP 状态码 |

---

## 1. 枚举值（固定，只能用这些）

```ts
type Category =
  | "research"      // 科研机会 Research & RA
  | "internship"    // 实习 Internships
  | "event"         // 学术活动 Academic Events
  | "competition"   // 竞赛 Competitions
  | "program"       // 学术项目 Academic Programs
  | "course";       // 课程与学习 Courses & Learning

type OpportunityStatus =
  | "verified"            // 已核实，信息有效
  | "needs_verification"  // 信息不全或未核实
  | "expired";            // 已过截止日期或页面失效

type EligibilityStatus =
  | "eligible"            // 符合条件
  | "ineligible"          // 不符合条件（存在明确且未满足的硬性要求）
  | "needs_confirmation"; // 需要进一步确认（信息不足）

// ⚠️ 上面两个枚举是不同层面的东西，不冲突，不能互相替换：
//   OpportunityStatus.needs_verification  → 这条【机会数据】本身是否核实过（A 负责，存数据库）
//   EligibilityStatus.needs_confirmation  → 【某个学生】对这条机会的资格能否判断（B 负责，实时计算，不存库）
// 原规划 3.4 的"需要进一步确认"对应 needs_confirmation；5.3 示例里的 "status": "needs_verification" 是机会状态。

type AcademicYear =
  | "freshman" | "sophomore" | "junior" | "senior" | "graduate";

type ApplicationStatus =
  | "saved" | "applying" | "applied" | "rejected" | "accepted";

type EligibilityType =
  | "academic_year" | "major" | "course" | "skill"
  | "hours_per_week" | "duration" | "work_authorization" | "gpa" | "other";
```

---

## 2. Opportunity（学术机会）

合并文档 3.3 的「每条机会需要保存的信息」、5.3 的 JSON 示例和 5.4 的 opportunities 表。
**A 写入 → B 读取 → C 展示**，三方共用此结构。

```ts
interface Opportunity {
  opportunity_id: string;          // uuid
  title: string;                   // 机会名称（必填）
  university: string;              // "UCSD"
  organization: string | null;     // 所属实验室 / 部门 / 机构
  category: Category;
  description: string | null;      // 项目简介
  required_skills: string[];       // 技能要求，如 ["Python", "R"]
  eligibility: EligibilityRequirement[]; // 申请要求（结构化）
  deadline: string | null;         // YYYY-MM-DD；无明确日期则 null
  deadline_text: string | null;    // 原文，如 "Rolling basis"、"Until filled"
  application_method: string | null; // 申请方式（邮件 / 表单链接 / 说明文字）
  source_url: string;              // 原始网页链接（唯一，用于去重）
  source_id: string | null;        // 关联 sources 表
  first_collected_at: string;      // 首次收集时间
  last_verified_at: string;        // 最近验证时间
  status: OpportunityStatus;
}

interface EligibilityRequirement {
  type: EligibilityType;
  value: string | number | string[] | null; // 例：["junior","senior"]、10、"CSE"
  raw_text: string;                // 网页原文片段，作为判断依据
  is_hard_requirement: boolean;    // true = 硬性要求；false = preferred / 加分项
}
```

**示例：**

```json
{
  "opportunity_id": "3f1c2a9e-0000-4000-8000-000000000001",
  "title": "Undergraduate Research Assistant",
  "university": "UCSD",
  "organization": "Example Computational Biology Lab",
  "category": "research",
  "description": "Assist with data analysis for genomics projects.",
  "required_skills": ["Python"],
  "eligibility": [
    { "type": "hours_per_week", "value": 10, "raw_text": "at least 10 hours per week", "is_hard_requirement": true },
    { "type": "course", "value": ["CSE 11"], "raw_text": "CSE 11 preferred", "is_hard_requirement": false }
  ],
  "deadline": null,
  "deadline_text": "Rolling basis",
  "application_method": "Email CV to the lab manager",
  "source_url": "https://example.ucsd.edu/lab/join",
  "source_id": null,
  "first_collected_at": "2026-11-14T20:00:00Z",
  "last_verified_at": "2026-11-14T20:00:00Z",
  "status": "needs_verification"
}
```

**A 的 Gemini 提取输出**：除 `opportunity_id`、`source_id`、`first_collected_at`、`last_verified_at` 由系统填写外，其余字段按上面的结构输出 JSON。

---

## 3. StudentProfile（学生档案）

对应文档 3.1 的四部分问卷 + 3.2 的简历提取。**B 和 C 共用。**

```ts
interface StudentProfile {
  user_id: string;                 // 由登录态决定，前端不传
  // 第一部分：基本学术背景
  university: string;              // "UCSD"
  major: string;
  minor: string | null;
  academic_year: AcademicYear;
  expected_graduation: string | null; // "YYYY-MM"
  courses_taken: string[];         // ["CSE 11", "MATH 20C"]
  // 第二部分：兴趣与目标
  interests: string[];             // 学术领域 ["AI", "Biology"]
  research_areas: string[];
  career_goals: string[];
  selected_modules: Category[];    // 希望关注的机会类别，决定 Dashboard 模块
  // 第三部分：技能与经历
  skills: string[];                // 编程语言 + 技术技能
  experiences: Experience[];
  // 第四部分：申请资格
  hours_per_week: number | null;
  available_terms: string[];       // ["Winter 2027", "Summer 2027"]
  work_authorization: string | null; // 仅学生主动填写；系统不得推测
  updated_at: string;
}

interface Experience {
  type: "research" | "internship" | "project" | "other";
  title: string;
  organization: string | null;
  description: string | null;
}
```

---

## 4. API

所有接口前缀 `/api`，JSON 输入输出。需要登录的接口从 session 取 `user_id`。

### 4.1 `GET /api/opportunities` — 机会列表（C 调用）

Query 参数（均可选）：

| 参数 | 类型 | 说明 |
|---|---|---|
| `category` | `Category`，可逗号分隔多个 | 类别筛选 |
| `university` | string | 默认 `UCSD` |
| `status` | `OpportunityStatus` | 默认排除 `expired` |
| `q` | string | 关键词搜索（title / description） |
| `sort` | `deadline` \| `newest` \| `relevance` | 默认 `deadline`；`relevance` 需登录 |
| `page` / `limit` | number | 默认 `1` / `20` |

返回：

```json
{
  "items": [ /* Opportunity[]；sort=relevance 时每项额外带 match 字段，见 4.4 */ ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### 4.2 `GET /api/profile` / `POST /api/profile` — 学生档案

- `GET` → `{ "profile": StudentProfile | null }`
- `POST` body：`StudentProfile`（不含 `user_id`、`updated_at`）→ `{ "profile": StudentProfile }`
  （有则更新，无则创建）

### 4.3 `POST /api/resume/parse` — 简历解析（B 实现）

- Content-Type：`multipart/form-data`，字段名 `file`，仅 PDF，**≤ 4MB**（Vercel 函数请求体上限约 4.5MB）
- 可选字段 `use_ai=true`：学生明确同意后才把文本发给 Gemini；否则只做本地标签提取
- **只解析、不保存**。学生确认后由前端调用 `POST /api/profile` 保存。

```json
{
  "extracted": { /* Partial<StudentProfile>，提取不到的字段省略或为 null */ }
}
```

### 4.4 `POST /api/match` — 资格判断 + 排序（D 路由，B 逻辑，见 §8）

Body：

```json
{ "opportunity_ids": ["..."] }   // 可选；不传则对所有未过期机会计算
```

返回（按 `relevance_score` 降序）：

```json
{
  "results": [
    {
      "opportunity_id": "...",
      "eligibility": {
        "status": "needs_confirmation",
        "checks": [
          { "type": "hours_per_week", "result": "eligible", "reason": "学生每周可投入 12 小时 ≥ 要求 10 小时" },
          { "type": "work_authorization", "result": "needs_confirmation", "reason": "页面未说明工作授权要求" }
        ]
      },
      "relevance_score": 82,
      "explanation": "与你的 AI 研究兴趣和 Python 技能相关。"
    }
  ]
}
```

规则（v1.1）：
- **单项检查** `checks[].result` 使用 `EligibilityStatus` 同一套枚举：满足 → `eligible`，明确不满足 → `ineligible`，无法判断 → `needs_confirmation`。
- **汇总** `eligibility.status`，按顺序判断：
  1. 任一 **硬性要求**（`is_hard_requirement: true`）为 `ineligible` → `ineligible`
  2. 机会本身 `status` 不是 `verified`（要求列表未确认完整）→ `needs_confirmation`
  3. 任一硬性要求为 `needs_confirmation` → `needs_confirmation`
  4. 否则 → `eligible`
- **非硬性要求**（preferred / 加分项）只出现在 `checks` 和解释里，**不影响汇总状态**。
- 没有被规则识别的要求 → `needs_confirmation`，并保留 `raw_text`，不得推测。
- `relevance_score`：0–100 的数字，或 `null`（学生没有提供任何可用于匹配的兴趣/技能/类别时）。**只表示相关程度，不代表申请成功概率**。排序时 `null` 排在最后，同分按 `opportunity_id` 稳定排序。
- 低匹配机会也要返回，不隐藏。
- 允许**额外附加**字段（不改名、不删字段即可）：`checks[].raw_text`、`reasons: string[]`、`questions_to_confirm: string[]`、顶层 `warnings`。

### 4.5 `POST /api/collect` — 触发采集（A 实现，**仅管理员 / 内部任务**）

需要请求头 `x-admin-token: <ADMIN_TOKEN>`。

Body（二选一）：

```json
{ "source_id": "..." }
{ "url": "https://..." }
```

返回：

```json
{
  "records_found": 5,
  "inserted": 3,
  "updated": 1,
  "duplicates": 1,
  "needs_verification": 2,
  "errors": []
}
```

每次调用同时写一条 `collection_logs`。

### 4.6 `/api/bookmarks` — 收藏与申请状态

- `GET /api/bookmarks` → `{ "items": [ { "opportunity": Opportunity, "application_status": ApplicationStatus, "updated_at": "..." } ] }`
- `POST /api/bookmarks` body `{ "opportunity_id": "...", "application_status": "saved" }` → 新建或更新
- `DELETE /api/bookmarks?opportunity_id=...` → `{ "ok": true }`

---

## 5. 数据库表（Neon PostgreSQL）

在文档 5.4 基础上补齐字段，列名与上面的 JSON 一致。

| 表 | 主键 | 关键字段 / 约束 |
|---|---|---|
| `users` | `user_id` | `email` unique、`created_at` |
| `student_profiles` | `user_id`（FK → users） | 第 3 节所有字段；数组用 `text[]`，`experiences` 用 `jsonb` |
| `opportunities` | `opportunity_id` | 第 2 节所有字段；**`source_url` unique**；`eligibility` 用 `jsonb`；`category` / `status` 加 CHECK 约束 |
| `sources` | `source_id` | `university`、`website_url` unique、`source_type`（`lab_page` / `department` / `calendar` / `listing` / `other`）、`last_checked_at` |
| `saved_opportunities` | (`user_id`, `opportunity_id`) | `application_status`、`updated_at` |
| `collection_logs` | `log_id` | `source_id`、`collection_time`、`records_found`、`errors` (`jsonb`) |

**安全**：公共机会数据（opportunities / sources）与私人数据（users / student_profiles / saved_opportunities）分开；私人数据接口必须校验 `user_id` 来自 session，禁止通过参数读取他人数据。

---

## 6. 环境变量（`.env.example`）

```
DATABASE_URL=
GEMINI_API_KEY=
BRIGHTDATA_API_KEY=
ADMIN_TOKEN=
AUTH_SECRET=
AI_SERVICE_URL=
INTERNAL_TOKEN=
GEMINI_MODEL=
```

真实值私下传，**不要提交进 git**。

---

## 7. 分工对照

| 模块 | 写入方 | 读取方 |
|---|---|---|
| Opportunity | A（采集） | B（匹配）、C（展示） |
| StudentProfile | C（问卷）、B（简历解析结果） | B（匹配） |
| `/api/match` 结果 | B | C |
| 数据库、鉴权、部署 | D | 全员 |

开发期间前端可先用 `GET /api/opportunities` 返回的假数据，不必等采集模块完成。

---

## 8. 接口归属与 Python 服务部署（v1.1）

### 8.1 架构

```
浏览器 (C) ──► Next.js /api/*  (D，唯一对外接口，Vercel)
                  │  读写 Neon、鉴权、取 user_id、参数校验
                  ├──► Python AI 服务 /internal/*  (B，Vercel 独立项目，无状态)
                  └──► Neon PostgreSQL
采集程序 (A，Python 脚本) ──► Neon（直接写 opportunities / sources / collection_logs）
```

### 8.2 接口归属

| 对外接口（C 只调这些） | 负责人 | 实现方式 |
|---|---|---|
| `GET /api/opportunities` | D | 直接查 Neon（已完成） |
| `GET/POST /api/profile` | D | 直接读写 Neon |
| `/api/bookmarks` | D | 直接读写 Neon |
| `POST /api/match` | D 路由 + **B 逻辑** | D 从 Neon 取学生档案和机会 → 调 B 的 `/internal/match` → 原样返回 |
| `POST /api/resume/parse` | D 路由 + **B 逻辑** | D 校验登录和文件 → 转发给 B 的 `/internal/resume/parse` |
| `POST /api/collect` | D 路由 + **A 逻辑** | 黑客松期间 A 可直接运行采集脚本，此接口为可选 |

### 8.3 B 的内部接口（Python）

- **无状态**：不连数据库、不需要 `DATABASE_URL`、不保存任何简历或档案。
- **鉴权**：只接受带请求头 `x-internal-token: <INTERNAL_TOKEN>` 的请求（Next.js 服务端调用，浏览器拿不到）。
- `POST /internal/match`
  - 输入：`{ "profile": StudentProfile, "opportunities": Opportunity[] }`（字段名严格按 §2、§3）
  - 输出：§4.4 的 `{ "results": [...] }`
- `POST /internal/resume/parse`
  - 输入：同 §4.3（multipart `file`，可选 `use_ai`）
  - 输出：`{ "extracted": Partial<StudentProfile> }`
- 档案合并（`profile/merge`）属于前端确认流程的辅助逻辑，可作为 `/internal/profile/merge` 保留，非必须。

**B 的适配层负责字段映射**，engine 内部命名可以不改，例如：

| B 原型内部 | 协议字段 |
|---|---|
| `weekly_hours_available` | `hours_per_week` |
| `education_level`（undergraduate/graduate） | 由 `academic_year` 推出：freshman–senior → undergraduate，graduate → graduate |
| `eligibility: string[]` | `eligibility: EligibilityRequirement[]`（优先用 `type`/`value` 判断，`raw_text` 兜底） |
| `eligibility_status` / `needs_verification` | `eligibility.status` / `needs_confirmation` |
| `eligibility_checks[].result`：met / not_met / unknown | `eligible` / `ineligible` / `needs_confirmation` |
| `match_score` | `relevance_score` |
| `match_reasons: string[]` | `explanation`（拼成一句）+ 可选 `reasons` |

### 8.4 部署

- B 的服务用 **FastAPI** 包装（原规划 5.1 技术栈），在 Vercel 上作为**独立项目**部署，Root Directory 设为 `services`，Python ≥ 3.11（部署时确认运行时版本）。
- 本地开发的 `server.py`（127.0.0.1:8765）保留为 demo，不上线。
- 环境变量：
  - Python 服务：`GEMINI_API_KEY`、`GEMINI_MODEL`、`INTERNAL_TOKEN`
  - Next.js：新增 `AI_SERVICE_URL`、`INTERNAL_TOKEN`（与上面相同的值）
- 如果 Vercel Python 部署在第 8 小时整合前没跑通：备选方案是把 `engine.py`（无依赖、约 120 行）移植成 TypeScript 放进 `lib/matching/`，简历解析暂时用本地 demo 演示。
