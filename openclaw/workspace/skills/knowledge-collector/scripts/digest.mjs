/**
 * digest.mjs — 每日简报生成
 * B 同学负责：汇总昨日新增知识，生成结构化简报
 * 兼容 D 同学的 Cron 定时任务，用于飞书推送
 * 
 * 用法：
 *   node scripts/digest.mjs --daily      查看昨日简报
 *   node scripts/digest.mjs --date 2026-07-06   查看指定日期简报
 *   node scripts/digest.mjs --help       帮助
 */

import { getYesterdayEntries, findByDateRange, getAllTags } from './store.mjs';

/**
 * 生成简报文本
 * @param {Object[]} entries - 知识条目数组
 * @param {string} dateLabel - 日期标签
 * @returns {Object} { text, count, tags, summaries }
 */
function generateDigest(entries, dateLabel) {
  if (entries.length === 0) {
    return {
      count: 0,
      tags: [],
      summaries: [],
      text: `📋 知识简报 — ${dateLabel}\n\n昨日暂无新增知识。`
    };
  }

  // 统计标签
  const tagMap = {};
  for (const e of entries) {
    for (const t of e.tags) {
      tagMap[t] = (tagMap[t] || 0) + 1;
    }
  }
  const sortedTags = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `${tag}(${count})`);

  // 生成条目列表
  const summaries = entries.map((e, i) => {
    return `${i + 1}. ${e.title}
   📎 ${e.url}
   🏷️  ${e.tags.join(', ')}
   📝 ${e.summary.substring(0, 150)}`;
  });

  // 组装文本
  const today = new Date().toISOString().split('T')[0];
  const text = [
    `📋 知识日报 — ${dateLabel}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `新增知识: ${entries.length} 条`,
    `热门标签: ${sortedTags.slice(0, 5).join(' | ') || '无'}`,
    ``,
    `📌 今日新增:`,
    ...summaries,
    ``,
    `📊 当前知识库总量: 使用 node scripts/query.mjs --list 查看`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🕐 生成时间: ${today}`
  ].join('\n');

  return {
    count: entries.length,
    tags: sortedTags,
    summaries,
    text
  };
}

function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--daily') options.daily = true;
    else if (args[i] === '--date' && i + 1 < args.length) options.date = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') options.help = true;
    else if (args[i] === '--json') options.json = true;
  }

  if (options.help || args.length === 0) {
    console.log(`
📋 knowledge-collector — 每日简报生成

用法:
  node scripts/digest.mjs --daily              查看昨日简报
  node scripts/digest.mjs --date 2026-07-06    查看指定日期简报
  node scripts/digest.mjs --daily --json       以 JSON 格式输出
  node scripts/digest.mjs --help               帮助

说明:
  简报内容包含新增知识数量、摘要、标签、复习问题。
  昨日无新增时返回"昨日暂无新增知识"。
`);
    return;
  }

  let entries;
  let dateLabel;

  if (options.date) {
    // 指定日期
    const start = `${options.date}T00:00:00.000Z`;
    const end = `${options.date}T23:59:59.999Z`;
    entries = findByDateRange(start, end);
    dateLabel = options.date;
  } else {
    // 昨日简报
    entries = getYesterdayEntries();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateLabel = yesterday.toISOString().split('T')[0];
  }

  const digest = generateDigest(entries, dateLabel);

  if (options.json) {
    console.log(JSON.stringify({
      date: dateLabel,
      count: digest.count,
      tags: digest.tags,
      entries: entries.map(e => ({
        id: e.id,
        title: e.title,
        url: e.url,
        tags: e.tags,
        summary: e.summary.substring(0, 200),
        createdAt: e.createdAt
      }))
    }, null, 2));
  } else {
    console.log(digest.text);
  }
}

main();
