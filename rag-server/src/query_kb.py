from dotenv import load_dotenv
from chroma_client import get_knowledge_collection, text_to_embedding

load_dotenv()

def search_knowledge(query, top_k=3):
    """
    语义检索：把问题转向量，从ChromaDB查最相关的片段
    返回：文档片段列表 + 来源描述 + 完整元数据
    """
    collection = get_knowledge_collection()
    
    # 1. 用户问题转向量
    query_embedding = text_to_embedding([query])
    
    # 2. 相似度检索
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k
    )
    
    documents = results['documents'][0]
    metadatas = results['metadatas'][0]
    
    # 兼容处理：安全取值，同时适配文档和网页两种元数据
    sources = []
    for meta in metadatas:
        source_type = meta.get("source_type", "document")
        if source_type == "webpage":
            title = meta.get("title", "未知网页")
            sources.append(f"网页：{title}")
        else:
            # 普通文档，安全获取source字段，不存在则返回默认值
            sources.append(meta.get("source", "未知来源"))
    
    return {
        "documents": documents,
        "sources": sources,
        "metadatas": metadatas  # 完整返回元数据，后续技能层可精细化展示
    }

if __name__ == "__main__":
    # 本地测试用
    res = search_knowledge("退款政策是什么")
    print("完整返回结果：", res)
    for i, doc in enumerate(res["documents"]):
        print(f"[片段{i+1}] 来源:{res['sources'][i]}")
        print(doc, "\n")