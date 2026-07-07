/**
 * collect.mjs — 网页抓取 + AI 摘要标签生成
 * B 同学负责：URL 安全校验、网页抓取、DeepSeek 摘要标签生成、入库反馈
 * 
 * 用法：
 *   node scripts/collect.mjs --url "https://example.com/article"
 *   node scripts/collect.mjs --url "https://example.com" --tags "AI,技术"
 *   node scripts/collect.mjs --status
 *   node scripts/collect.mjs --help
 */

import fetch from 'node-fetch';
import iconv from 'iconv-lite';
import { addEntry, getCount, getAllTags } from './store.mjs';

// ============================================================
// 配置
// ============================================================
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const FETCH_TIMEOUT_MS = 15000;
const MAX_CONTENT_LENGTH = 8000;

// ============================================================
// URL 安全校验
// ============================================================

/** 内网 IP 正则 */
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0$/,
  /^localhost$/i,
  /::1$/
];

/** 禁止的协议 */
const BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'data:', 'javascript:', 'vbscript:', 'blob:'];

/**
 * 校验 URL 是否安全
 * @param {string} urlStr
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateUrl(urlStr) {
  try {
    const url = new URL(urlStr);

    // 检查协议
    if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
      return { ok: false, reason: `不允许的协议: ${url.protocol}` };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, reason: `只支持 http/https 协议, 收到: ${url.protocol}` };
    }

    // 检查内网地址
    const hostname = url.hostname;
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { ok: false, reason: `拒绝内网地址: ${hostname}` };
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `无效 URL: ${err.message}` };
  }
}

// ============================================================
// 网页抓取
// ============================================================

/**
 * 从 Content-Type 或 HTML meta 中检测编码
 */
function detectEncoding(response, htmlBuffer) {
  // 1. 优先从 Content-Type 响应头获取
  const contentType = response.headers.get('content-type') || '';
  const charsetMatch = contentType.match(/charset\s*=\s*([^\s;]+)/i);
  if (charsetMatch) {
    const cs = charsetMatch[1].toLowerCase();
    if (cs !== 'utf-8' && cs !== 'utf8') return cs;
  }

  // 2. 从 HTML meta 标签检测
  const meta = htmlBuffer.toString('utf-8', 0, Math.min(htmlBuffer.length, 4096));
  const metaMatch = meta.match(/<meta[^>]+charset\s*=\s*["']?([^\s"'\/>]+)/i);
  if (metaMatch) {
    const cs = metaMatch[1].toLowerCase();
    if (cs !== 'utf-8' && cs !== 'utf8') return cs;
  }

  return 'utf-8';
}

/**
 * 抓取网页并提取正文
 */
async function fetchPage(urlStr) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 用 buffer 读取，自动检测编码后解码
    const arrayBuffer = await response.arrayBuffer();
    const htmlBuffer = Buffer.from(arrayBuffer);
    const encoding = detectEncoding(response, htmlBuffer);
    const html = encoding === 'utf-8'
      ? htmlBuffer.toString('utf-8')
      : iconv.decode(htmlBuffer, encoding);
    
    // 简单提取标题
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '无标题';

    // 简单提取正文（去除 HTML 标签）
    let content = html
      // 移除 script 和 style 块
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      // 移除 HTML 标签
      .replace(/<[^>]+>/g, ' ')
      // 合并空白
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    // 限制长度
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.substring(0, MAX_CONTENT_LENGTH) + '...';
    }

    return { title, content, success: content.length > 50 };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('请求超时：抓取超过 15 秒');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// DeepSeek 摘要标签生成
// ============================================================

/**
 * 调用 DeepSeek 生成摘要和标签
 * @param {string} title - 页面标题
 * @param {string} content - 正文内容
 * @returns {Promise<{ summary: string, tags: string[] }>}
 */
async function generateSummaryAndTags(title, content) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  未设置 DEEPSEEK_API_KEY 环境变量，使用简单摘要替代');
    return {
      summary: content.substring(0, 300) + '...',
      tags: ['未分类']
    };
  }

  const prompt = `你是一个知识整理助手。请分析以下网页内容，提供：
1. 一个简洁的中文摘要（100-200字）
2. 3-5个相关中文标签

请严格按照以下 JSON 格式返回，不要包含其他内容：
{"summary": "摘要...", "tags": ["标签1", "标签2", "标签3"]}

网页标题：${title}
网页内容：
${content.substring(0, 4000)}`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: '你是一个专业的知识整理助手，只返回 JSON 格式的结果。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API 错误: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices[0]?.message?.content || '';

    // 尝试解析 JSON
    try {
      // 查找 JSON 块
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || content.substring(0, 200),
          tags: Array.isArray(parsed.tags) ? parsed.tags : ['未分类']
        };
      }
    } catch {
      // JSON 解析失败，使用结果文本作为摘要
    }

    return {
      summary: resultText.substring(0, 500),
      tags: ['未分类']
    };
  } catch (err) {
    console.error('❌ DeepSeek 调用失败:', err.message);
    return {
      summary: content.substring(0, 300) + '...',
      tags: ['未分类']
    };
  }
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  
  // 解析命令行参数
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && i + 1 < args.length) {
      options.url = args[++i];
    } else if (args[i] === '--tags' && i + 1 < args.length) {
      options.tags = args[++i].split(',').map(t => t.trim()).filter(Boolean);
    } else if (args[i] === '--status') {
      options.status = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      options.help = true;
    }
  }

  // 帮助
  if (options.help || args.length === 0) {
    console.log(`
📚 knowledge-collector — 智能知识收集器

用法:
  node scripts/collect.mjs --url <URL>             收集一条知识
  node scripts/collect.mjs --url <URL> --tags "a,b" 指定额外标签
  node scripts/collect.mjs --status                 查看知识库状态
  node scripts/collect.mjs --help                   显示此帮助

环境变量:
  DEEPSEEK_API_KEY   DeepSeek API Key（可选，无则使用简单摘要）
`);
    return;
  }

  // 状态查询
  if (options.status) {
    const count = getCount();
    const tags = getAllTags();
    console.log(`📊 知识库状态`);
    console.log(`   总条目数: ${count}`);
    console.log(`   标签统计:`);
    if (tags.length === 0) {
      console.log(`   暂无标签`);
    } else {
      for (const { tag, count: c } of tags) {
        console.log(`     - ${tag} (${c})`);
      }
    }
    return;
  }

  // 收集知识
  if (options.url) {
    console.log(`🔍 开始收集: ${options.url}`);
    console.log('');

    // 1. URL 安全校验
    console.log('🔒 步骤 1/4: URL 安全校验...');
    const validation = validateUrl(options.url);
    if (!validation.ok) {
      console.error(`❌ URL 校验失败: ${validation.reason}`);
      process.exit(1);
    }
    console.log(`   ✅ URL 校验通过`);

    // 2. 网页抓取
    console.log('🌐 步骤 2/4: 抓取网页内容...');
    let page;
    try {
      page = await fetchPage(options.url);
      console.log(`   标题: ${page.title}`);
      console.log(`   正文长度: ${page.content.length} 字符`);
    } catch (err) {
      console.error(`❌ 网页抓取失败: ${err.message}`);
      process.exit(1);
    }

    // 3. AI 摘要标签
    console.log('🤖 步骤 3/4: 生成 AI 摘要和标签...');
    const result = await generateSummaryAndTags(page.title, page.content);
    const mergedTags = [...new Set([...(options.tags || []), ...result.tags])];
    console.log(`   摘要: ${result.summary.substring(0, 100)}...`);
    console.log(`   标签: ${mergedTags.join(', ')}`);

    // 4. 入库
    console.log('💾 步骤 4/4: 知识入库...');
    const entry = addEntry({
      url: options.url,
      title: page.title,
      summary: result.summary,
      tags: mergedTags,
      content: page.content
    });
    console.log(`   ✅ 入库成功!`);
    console.log(`   ID: ${entry.id}`);
    console.log(`   时间: ${entry.createdAt}`);
    console.log('');
    console.log(`📝 已保存知识: ${entry.title}`);
    console.log(`📎 URL: ${entry.url}`);
    console.log(`🏷️  标签: ${entry.tags.join(', ')}`);
    console.log(`📋 摘要: ${entry.summary}`);
    return;
  }

  console.log('❌ 请提供 --url 参数。使用 --help 查看用法。');
  process.exit(1);
}

main().catch(err => {
  console.error('❌ 程序出错:', err.message);
  process.exit(1);
});
