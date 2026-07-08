/**
 * query.mjs — 知识检索查询工具
 * B 同学负责：知识库查询、标签筛选、关键词搜索
 * 
 * 用法：
 *   node scripts/query.mjs --list             列出所有知识
 *   node scripts/query.mjs --tag "AI"         按标签筛选
 *   node scripts/query.mjs --search "关键词"   搜索关键词
 *   node scripts/query.mjs --id "KN-xxx"      按 ID 查询
 *   node scripts/query.mjs --tags             列出所有标签及计数
 *   node scripts/query.mjs --help             帮助
 */

import { loadAll, findByTag, search, getById, getAllTags, getCount } from './store.mjs';

function printEntry(e, index) {
  const prefix = index !== undefined ? `[${index}] ` : '';
  console.log(`${prefix}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ID:      ${e.id}`);
  console.log(`  标题:    ${e.title}`);
  console.log(`  URL:     ${e.url}`);
  console.log(`  标签:    ${e.tags.join(', ')}`);
  console.log(`  摘要:    ${e.summary.substring(0, 200)}`);
  console.log(`  时间:    ${e.createdAt}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--list') options.list = true;
    else if (args[i] === '--tag' && i + 1 < args.length) options.tag = args[++i];
    else if (args[i] === '--search' && i + 1 < args.length) options.search = args[++i];
    else if (args[i] === '--id' && i + 1 < args.length) options.id = args[++i];
    else if (args[i] === '--tags') options.showTags = true;
    else if (args[i] === '--help' || args[i] === '-h') options.help = true;
  }

  if (options.help || args.length === 0) {
    console.log(`
🔍 knowledge-collector — 知识检索

用法:
  node scripts/query.mjs --list                   列出所有知识
  node scripts/query.mjs --tag <标签>             按标签筛选
  node scripts/query.mjs --search <关键词>         搜索
  node scripts/query.mjs --id <ID>                按 ID 查询
  node scripts/query.mjs --tags                   列出所有标签
  node scripts/query.mjs --help                   帮助
`);
    return;
  }

  // 列出所有标签
  if (options.showTags) {
    const tags = getAllTags();
    console.log(`🏷️  标签统计 (共 ${getCount()} 条知识):`);
    if (tags.length === 0) {
      console.log('   暂无标签');
    } else {
      for (const { tag, count } of tags) {
        console.log(`   ${tag}: ${count} 条`);
      }
    }
    return;
  }

  // 按 ID 查询
  if (options.id) {
    const entry = getById(options.id);
    if (!entry) {
      console.log(`❌ 未找到 ID 为 "${options.id}" 的知识`);
      return;
    }
    printEntry(entry);
    return;
  }

  let results = [];

  // 按标签筛选
  if (options.tag) {
    results = findByTag(options.tag);
    console.log(`🏷️  标签 "${options.tag}" 的搜索结果 (${results.length} 条):`);
  }
  // 搜索关键词
  else if (options.search) {
    results = search(options.search);
    console.log(`🔍 关键词 "${options.search}" 的搜索结果 (${results.length} 条):`);
  }
  // 列出所有
  else if (options.list) {
    results = loadAll();
    console.log(`📚 知识库共 ${results.length} 条:`);
  }

  // 按时间倒序排列
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (results.length === 0) {
    console.log('   暂无匹配的知识条目。');
    return;
  }

  results.forEach((entry, i) => printEntry(entry, i + 1));
}

main();
