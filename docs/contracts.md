# Academic Compass — 数据与接口约定（contracts.md）

> 依据：SanD 规划文档 3.3 / 5.3 / 5.4 / 7.3。文档已定的内容不改，本文件只把字段统一、补齐类型与格式。
> 负责人：D（Backend & Integration）。**改字段名前先在群里说**；新增字段可以直接加，但要同步更新本文件。

---

## 0. 通用约定

| 规则 | 说明 |
|---|---|
| 命名 | JSON 字段和数据库列一律 `snake_case` |
| 时间戳 | ISO 8601 UTC，如 `2026-11-14T19:00:00Z`（数据库用 `timestamptz`） |
| 日期 | `YYYY-MM-DD`，如 `2026-12-01` |
| 未知值 | 单值字段用 `null`；**不要**用 `""`、`"N/A"`、`"unknown"`。AI 不得猜测填充 |
| 数组 | 没有提取到内容时用 `[]` |
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

- Content-Type：`multipart/form-data`，字段名 `file`，仅 PDF，≤ 5MB
- **只解析、不保存**。学生确认后由前端调用 `POST /api/profile` 保存。

```json
{
  "extracted": { /* Partial<StudentProfile>，提取不到的字段省略或为 null */ }
}
```

### 4.4 `POST /api/match` — 资格判断 + 排序（B 实现）

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

规则：
- `eligibility.status` 汇总规则：任一硬性要求 `ineligible` → `ineligible`；否则任一 `needs_confirmation` → `needs_confirmation`；否则 `eligible`。
- `relevance_score`：0–100，**只表示相关程度，不代表申请成功概率**。
- 低匹配机会也要返回，不隐藏。

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
