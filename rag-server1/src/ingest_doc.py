import os
from pypdf import PdfReader
from docx import Document
from dotenv import load_dotenv
from chroma_client import get_knowledge_collection, text_to_embedding
from split_text import split_text

load_dotenv()
UPLOAD_DIR = "../data/uploads"

def load_document_text(file_path):
    """通用文档文本提取：根据文件后缀自动选择解析方式"""
    ext = os.path.splitext(file_path)[1].lower()

    # 1. 解析 PDF 文档
    if ext == ".pdf":
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text

    # 2. 解析纯文本 / Markdown 文档
    elif ext in [".txt", ".md"]:
        # Windows 环境优先用 utf-8 读取，失败则用 gbk 兜底，避免中文乱码
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            with open(file_path, "r", encoding="gbk", errors="ignore") as f:
                return f.read()

    # 3. 解析 Word 文档 (.docx)
    elif ext == ".docx":
        doc = Document(file_path)
        # 逐段提取正文，换行拼接
        text = "\n".join([para.text for para in doc.paragraphs])
        return text

    # 不支持的格式返回空文本并提示
    else:
        print(f"  跳过不支持的格式: {os.path.basename(file_path)}")
        return ""

def ingest_all_docs():
    """批量导入 uploads 目录下所有支持格式的文档"""
    collection = get_knowledge_collection()
    all_chunks = []
    all_sources = []

    # 统一管理支持的文件后缀，后续新增格式只需扩展这里
    support_exts = {".pdf", ".txt", ".md", ".docx"}

    # 遍历目录下所有文件
    for filename in os.listdir(UPLOAD_DIR):
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # 跳过子文件夹（只处理根目录文件），如需递归子目录可换成 os.walk
        if not os.path.isfile(file_path):
            continue

        ext = os.path.splitext(filename)[1].lower()
        if ext not in support_exts:
            continue

        print(f"正在处理: {filename}")
        try:
            # 1. 提取纯文本
            content = load_document_text(file_path)
            if not content.strip():
                print(f"  跳过空文档: {filename}")
                continue

            # 2. 切分文本片段
            chunks = split_text(content)
            all_chunks.extend(chunks)
            all_sources.extend([filename] * len(chunks))
            print(f"  切分为 {len(chunks)} 个片段")

        except Exception as e:
            print(f"  处理失败: {e}")
            continue

    if not all_chunks:
        print("没有找到可处理的文档，请检查 uploads 目录")
        return

    # 3. 批量生成向量
    print("\n正在生成向量并入库...")
    embeddings = text_to_embedding(all_chunks)
    
    # 4. 批量存入 ChromaDB
    collection.add(
        documents=all_chunks,
        embeddings=embeddings,
        metadatas=[{"source": src} for src in all_sources],
        ids=[f"doc_{i}" for i in range(len(all_chunks))]
    )
    print(f"入库完成！共存入 {len(all_chunks)} 条文本片段")

if __name__ == "__main__":
    ingest_all_docs()