import os
import shutil
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from query_kb import search_knowledge
from ingest_doc import load_document_text, split_text
from chroma_client import get_knowledge_collection, text_to_embedding
import uuid
from fastapi import HTTPException
from pydantic import BaseModel

load_dotenv()
app = FastAPI(title="RAG检索服务")

# 定义网页知识的请求体结构
class WebPageIngestRequest(BaseModel):
    id: str
    url: str
    title: str
    summary: str
    tags: list[str]
    content: str
    createdAt: str = None
    updatedAt: str = None

@app.post("/api/ingest-webpage")
async def ingest_webpage(request: WebPageIngestRequest):
    """
    接收结构化网页JSON，切分后向量化写入ChromaDB
    支持去重：同一URL已存在时先删除旧数据再写入新版本
    """
    collection = get_knowledge_collection()
    
    # 1. 去重：先删除该URL的旧数据（避免重复）
    try:
        old_data = collection.get(where={"url": request.url})
        if old_data["ids"]:
            collection.delete(ids=old_data["ids"])
    except Exception:
        pass

    # 2. 拼接待向量化的核心文本（摘要+正文，增强语义）
    full_text = f"标题：{request.title}\n摘要：{request.summary}\n正文：{request.content}"
    
    # 3. 文本切分（复用你现有的切分函数，和文档入库保持一致的粒度）
    chunks = split_text(full_text, chunk_size=500, chunk_overlap=50)
    
    # 4. 批量生成向量
    embeddings = text_to_embedding(chunks)
    
    # 5. 生成每条片段的ID和元数据
    ids = [f"web-{request.id}-{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "source_type": "webpage",  # 标记类型，和普通文档区分
            "web_id": request.id,
            "url": request.url,
            "title": request.title,
            "tags": ",".join(request.tags),  # ChromaDB元数据兼容字符串，方便过滤
            "summary": request.summary,
            "created_at": request.createdAt or "",
            "chunk_index": i
        }
        for i in range(len(chunks))
    ]
    
    # 6. 批量写入数据库
    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas
    )
    
    return {
        "success": True,
        "url": request.url,
        "title": request.title,
        "chunk_count": len(chunks),
        "message": f"网页知识入库成功，共切分为 {len(chunks)} 个片段"
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 上传文件保存目录（对应你现有的 uploads 路径）
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(os.path.dirname(BASE_DIR), "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class SearchRequest(BaseModel):
    query: str
    top_k: int = 3

@app.post("/api/search")
def search(request: SearchRequest):
    """语义检索接口"""
    result = search_knowledge(request.query, request.top_k)
    return {
        "success": True,
        "query": request.query,
        "documents": result["documents"],
        "sources": result["sources"]
    }

@app.post("/api/upload-ingest")
async def upload_and_ingest(file: UploadFile = File(...)):
    """
    上传文件并自动入库到知识库
    支持格式：pdf/txt/md/docx
    """
    try:
        # 1. 保存上传的文件到 uploads 目录
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. 提取文本 + 切分
        content = load_document_text(file_path)
        if not content.strip():
            return {"success": False, "error": "文件内容为空或不支持的格式"}
        
        chunks = split_text(content)

        # 3. 批量转向量并存入 ChromaDB
        collection = get_knowledge_collection()
        embeddings = text_to_embedding(chunks)
        
        import uuid
        collection.add(
            documents=chunks,
            embeddings=embeddings,
            metadatas=[{"source": file.filename} for _ in chunks],
            ids=[f"doc_{uuid.uuid4().hex}_{i}" for i in range(len(chunks))]
        )

        return {
            "success": True,
            "filename": file.filename,
            "chunk_count": len(chunks),
            "message": f"文件入库成功，共切分为 {len(chunks)} 个知识片段"
        }

    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=int(os.getenv("SERVER_PORT", 3000)),
        reload=True
    )