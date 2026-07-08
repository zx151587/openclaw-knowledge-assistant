

# OpenClaw RAG 私有知识库后端
基于 Python + ChromaDB 的本地向量知识库服务，为 OpenClaw 自定义技能提供文档入库、语义检索、网页知识结构化存储能力。

## 技术栈
- Web 框架：FastAPI + Uvicorn
- 向量数据库：ChromaDB
- 嵌入模型：Sentence-Transformers
- 前端对接：OpenClaw 自定义技能（Node.js）

## 快速启动
1. 创建虚拟环境并安装依赖
```bash
python -m venv venv
# Windows 激活
.\venv\Scripts\activate
pip install -r requirements.txt
# 运行数据库服务
chroma run --path ../data/chroma --port 8000 --host 0.0.0.0

```