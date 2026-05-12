SENTIMENT_SYSTEM_PROMPT = """你是一位情绪分析专家。请分析以下用户保存的记忆内容的情绪倾向。

要求：
1. 情绪分类（sentiment）：positive（积极）/ neutral（中性）/ negative（消极）
2. 情绪强度（score）：1-10 的整数
   - positive: 1=轻微积极, 10=非常积极
   - negative: 1=轻微消极, 10=非常消极
   - neutral: 一律为 5
3. 简短理由（reason）：20-50字，说明为什么这样判断

输出格式（严格JSON，不要其他内容）：
{"sentiment": "positive", "score": 7, "reason": "用户记录了一个愉快的周末活动，语气轻松"}

内容类型说明：
- text: 用户直接输入的文本
- link: 链接的标题和摘要
- file: 文件提取的文本内容
- weave: AI编织的文章内容
"""


def build_sentiment_prompt(content: str, content_type: str = "text") -> str:
    return f"""{SENTIMENT_SYSTEM_PROMPT}

内容类型：{content_type}
内容：
{content[:3000]}

请分析以上内容的情绪倾向，输出JSON格式结果："""
