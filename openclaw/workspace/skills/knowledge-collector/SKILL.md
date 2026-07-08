---
name: "knowledge-collector"
description: "智能知识收集器：网页抓取、AI摘要标签、知识入库与RAG检索"
display_name: 知识收集器
author: B
permissions: |
  - 网络访问权限（网页抓取）
  - 文件读写权限（知识库存储）
  - DeepSeek API 调用权限（摘要标签生成）
---

# knowledge-collector — 智能知识收集器

收集网页内容，自动生成 AI 摘要和标签，存入本地知识库，支持 RAG 检索和每日简报。

---

## 功能概览

| 功能 | 说明 |
|------|------|
| 🌐 网页抓取 | 抓取指定 URL 的正文内容 |
| 🤖 AI 摘要 | 接入 DeepSeek 生成结构化摘要 |
| 🏷️ 自动标签 | 从内容中提取关键词标签 |
| 💾 知识入库 | 将（URL、标题、摘要、标签、时间）存入本地库 |
| 🔍 知识检索 | 按标签、关键词、时间范围查询 |
| 📋 每日简报 | 汇总昨日新增知识，用于飞书推送 |

---

## 命令与使用

### 收集一条知识

```bash
# 从 URL 收集
node scripts/collect.mjs --url "https://example.com/article"

# 可选指定标签
node scripts/collect.mjs --url "https://example.com" --tags "AI,技术"
```

### 查看已收集的知识

```bash
# 列出所有知识
node scripts/query.mjs --list

# 按标签筛选
node scripts/query.mjs --tag "AI"

# 搜索关键词
node scripts/query.mjs --search "机器学习"
```

### 生成每日简报

```bash
node scripts/digest.mjs --daily
```

### 查看状态

```bash
node scripts/collect.mjs --status
```

---

## 架构设计

```
knowledge-collector/
├── SKILL.md                    # Skill 定义
├── package.json                # Node 依赖
├── scripts/
│   ├── collect.mjs             # 网页抓取 + 摘要标签 (主入口)
│   ├── store.mjs               # 知识存储层 (JSON 文件库)
│   ├── query.mjs               # 知识检索查询
│   └── digest.mjs              # 每日简报生成
└── data/
    └── knowledge.json          # 知识存储文件
```

### 数据流

```
[URL] → 网页抓取 → 正文提取 → DeepSeek 摘要+标签 → 入库 → knowledge.json
                                                                  ↓
                                                         [查询/简报/飞书推送]
```

### 安全校验

- URL 只允许 `http://` 和 `https://` 协议
- 拒绝内网地址（127.0.0.1, 10.x.x.x, 172.16-31.x.x, 192.168.x.x）
- 拒绝 file://、ftp://、data: 等非标准协议
- 超时限制：15 秒

---

## 依赖

- Node.js >= 18
- `node-fetch`（npm 包，用于网页抓取）

## 集成说明

- 本 Skill 使用 DeepSeek API 生成摘要和标签
- 知识库存储为本地 JSON 文件，方便 C 同学（Chromadb）后续迁移
- 每日简报格式与 D 同学的 Cron 定时任务兼容

## 触发词

"收集知识"、"保存文章"、"抓取网页"、"每日简报"、"知识检索"
