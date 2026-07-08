from langchain_text_splitters import RecursiveCharacterTextSplitter

def split_text(text, chunk_size=250, chunk_overlap=50):
    """
    智能切分文本为语义片段
    :param text: 原始纯文本
    :param chunk_size: 每个片段的最大字符数，中文建议 200-300
    :param chunk_overlap: 片段间重叠字符数，保留上下文连贯性
    :return: 切分后的文本片段列表
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n## ", "\n### ", "\n", "。", "；", "，", " ", ""],
        length_function=len,
        is_separator_regex=False
    )
    return text_splitter.split_text(text)