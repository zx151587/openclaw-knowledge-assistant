/**
 * store.mjs — 知识存储层
 * B 同学负责：知识入库、查询、标签管理
 * 
 * 使用本地 JSON 文件存储知识条目，后续可由 C 同学迁移至 ChromaDB。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');
const DATA_FILE = resolve(DATA_DIR, 'knowledge.json');

/**
 * 确保数据目录和文件存在
 */
function ensureDataFile() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

/**
 * 读取所有知识条目
 */
export function loadAll() {
  ensureDataFile();
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * 保存所有知识条目
 */
function saveAll(entries) {
  ensureDataFile();
  writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

/**
 * 生成唯一 ID
 */
function generateId() {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `KN-${now}-${rand}`;
}

/**
 * 添加一条知识
 * @param {Object} entry - 知识条目
 * @param {string} entry.url - 来源 URL
 * @param {string} entry.title - 标题
 * @param {string} entry.summary - AI 摘要
 * @param {string[]} entry.tags - 标签列表
 * @param {string} [entry.content] - 原始内容片段
 * @returns {Object} 入库后的条目
 */
export function addEntry({ url, title, summary, tags, content = '' }) {
  const entries = loadAll();
  const entry = {
    id: generateId(),
    url,
    title,
    summary,
    tags: tags || [],
    content: content.substring(0, 2000), // 限制原始内容长度
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  entries.push(entry);
  saveAll(entries);
  return entry;
}

/**
 * 按 ID 查询
 */
export function getById(id) {
  const entries = loadAll();
  return entries.find(e => e.id === id) || null;
}

/**
 * 按标签筛选
 * @param {string} tag - 标签名（模糊匹配）
 */
export function findByTag(tag) {
  const entries = loadAll();
  const lowerTag = tag.toLowerCase();
  return entries.filter(e =>
    e.tags.some(t => t.toLowerCase().includes(lowerTag))
  );
}

/**
 * 搜索关键词（匹配标题、摘要、标签）
 */
export function search(keyword) {
  const entries = loadAll();
  const lower = keyword.toLowerCase();
  return entries.filter(e =>
    e.title.toLowerCase().includes(lower) ||
    e.summary.toLowerCase().includes(lower) ||
    e.tags.some(t => t.toLowerCase().includes(lower))
  );
}

/**
 * 按日期范围查询
 * @param {string} start - ISO 起始日期
 * @param {string} [end] - ISO 结束日期（默认今天）
 */
export function findByDateRange(start, end) {
  const entries = loadAll();
  const endDate = end || new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';
  return entries.filter(e => {
    const created = new Date(e.createdAt);
    return created >= new Date(start) && created <= new Date(endDate);
  });
}

/**
 * 获取昨天的知识
 */
export function getYesterdayEntries() {
  const now = new Date();
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  
  const yesterdayEnd = new Date(now);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  yesterdayEnd.setHours(23, 59, 59, 999);
  
  return findByDateRange(yesterdayStart.toISOString(), yesterdayEnd.toISOString());
}

/**
 * 获取所有标签及其计数
 */
export function getAllTags() {
  const entries = loadAll();
  const tagCount = {};
  for (const e of entries) {
    for (const t of e.tags) {
      tagCount[t] = (tagCount[t] || 0) + 1;
    }
  }
  return Object.entries(tagCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 获取总条目数
 */
export function getCount() {
  return loadAll().length;
}

/**
 * 删除一条知识
 */
export function deleteById(id) {
  const entries = loadAll();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  saveAll(entries);
  return true;
}

/**
 * 更新一条知识
 */
export function updateEntry(id, updates) {
  const entries = loadAll();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...updates, updatedAt: new Date().toISOString() };
  saveAll(entries);
  return entries[idx];
}
