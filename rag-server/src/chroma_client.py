import os
import chromadb
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

from sentence_transformers import SentenceTransformer

# 初始化嵌入模型（全局只加载一次，提升速度）
embed_model = SentenceTransformer(os.getenv("EMBEDDING_MODEL"))

def get_chroma_client():
    """
    改为 HTTP 客户端，连接本地 8000 端口的 ChromaDB 服务
    替代之前的 PersistentClient
    """
    client = chromadb.HttpClient(
        host=os.getenv("CHROMA_HOST", "localhost"),
        port=int(os.getenv("CHROMA_PORT", 8000))
    )
    return client

def get_knowledge_collection():
    """获取/创建知识库集合，逻辑完全不变"""
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=os.getenv("COLLECTION_NAME"),
        metadata={"hnsw:space": "cosine"}
    )
    return collection

# 文本转向量工具函数，完全不变
def text_to_embedding(texts):
    embeddings = embed_model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()