

module.exports = async function (args, context) {
  // 场景1：用户上传了文件 → 自动入库到知识库
  if (context.message && context.message.attachments && context.message.attachments.length > 0) {
    const results = [];
    
    for (const file of context.message.attachments) {
      try {
        // 从 OpenClaw 下载文件
        const fileRes = await fetch(file.download_url);
        const fileBuffer = await fileRes.buffer();

        // 调用 Python 服务的上传入库接口
        const formData = new FormData();
        formData.append('file', fileBuffer, file.file_name);

        const res = await fetch('http://localhost:3000/api/upload-ingest', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          results.push(`✅ ${data.filename}：入库成功，共 ${data.chunk_count} 个知识片段`);
        } else {
          results.push(`❌ ${file.file_name}：入库失败 - ${data.error}`);
        }
      } catch (err) {
        results.push(`❌ ${file.file_name}：处理失败 - ${err.message}`);
      }
    }

    return `文件处理结果：\n${results.join('\n')}\n\n现在你可以直接提问相关内容，我会从知识库中检索答案。`;
  }

  // 场景2：普通文本提问 → 检索知识库并返回参考内容
  const { query } = args;
  try {
    const response = await fetch('http://localhost:3000/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        top_k: 3
      })
    });

    const result = await response.json();
    if (!result.success || !result.documents || result.documents.length === 0) {
      return "未从私有知识库中检索到相关内容，请换一种问法，或确认知识库是否已录入对应内容";
    }

    const docs = result.documents
      .map((doc, i) => `[参考资料${i+1} 来源:${result.sources[i]}]: ${doc}`)
      .join('\n\n');
    
    return `以下是从私有知识库中检索到的相关内容，请基于这些内容回答用户问题：\n${docs}`;
    
  } catch (err) {
    return `知识库检索失败：${err.message}，请检查RAG检索服务是否正常启动`;
  }
};