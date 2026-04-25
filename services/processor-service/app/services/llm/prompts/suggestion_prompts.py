"""AI Suggestion prompt templates for Echoes companion feature.

Prompts are designed per D-07/D-08/D-09 from Phase 8 context:
- Text suggestions: warm, understanding, 50-150 Chinese characters
- Link suggestions: knowledge/insight style, associate with existing notes
- User style preference (gentle/practical/inspiring) injected dynamically
"""

# Style-specific persona modifiers
STYLE_PERSONAS = {
    "gentle": "你是一位温柔体贴的伙伴，语气柔和、充满关怀，善于察觉情绪并给予温暖的回应。",
    "practical": "你是一位务实高效的助手，语气直接、注重行动，善于提供可执行的建议和知识关联。",
    "inspiring": "你是一位富有洞察力的启发者，语气充满好奇、善于发现连接，鼓励用户探索和创造。",
}

DEFAULT_STYLE = "inspiring"


def build_text_suggestion_prompt(content: str, note: str, style: str) -> str:
    """Build a prompt for generating a text content suggestion.

    Args:
        content: The memory text content.
        note: Optional user note.
        style: User preference style (gentle/practical/inspiring).

    Returns:
        A formatted prompt string for the LLM.
    """
    persona = STYLE_PERSONAS.get(style, STYLE_PERSONAS[DEFAULT_STYLE])

    prompt = f"""{persona}

你的任务：根据用户保存的内容，生成一条简短、温暖、有建设性的建议或反馈。

要求：
- 长度：50-150个汉字
- 语气：温暖、理解、不矫情
- 多用问句和邀请式语言，避免说教
- 根据内容类型自然选择策略：
  - 负面情绪 → 安慰 + 温和引导
  - 问题/困惑 → 提供思考角度
  - 学习笔记 → 关联知识、鼓励深入
  - 灵感/创意 → 建议后续行动或时间胶囊
  - 平淡日常 → 温和增强，建议补充细节

用户保存的内容：
{content}
"""
    if note:
        prompt += f"\n用户备注：{note}\n"

    prompt += """
请直接输出建议内容，不要加引号、标题或任何格式标记。只输出纯文本建议。"""
    return prompt


def build_link_suggestion_prompt(link_url: str, link_title: str, link_summary: str, note: str, style: str) -> str:
    """Build a prompt for generating a link content suggestion.

    Args:
        link_url: The saved link URL.
        link_title: The link title (may be empty).
        link_summary: The link summary (may be empty).
        note: Optional user note.
        style: User preference style (gentle/practical/inspiring).

    Returns:
        A formatted prompt string for the LLM.
    """
    persona = STYLE_PERSONAS.get(style, STYLE_PERSONAS[DEFAULT_STYLE])

    prompt = f"""{persona}

你的任务：根据用户保存的链接内容，生成一条有洞察力的建议或反馈。

要求：
- 长度：50-150个汉字
- 语气：知识型、洞察型
- 根据链接类型自然选择策略：
  - 技术文章 → 关联已有笔记，建议组成专题
  - 新闻/资讯 → 背景关联，发现趋势
  - 教程/课程 → 预估时间，优先级建议
  - 设计/灵感 → 趋势发现，风格对比

用户保存的链接：{link_url}
"""
    if link_title:
        prompt += f"标题：{link_title}\n"
    if link_summary:
        prompt += f"摘要：{link_summary}\n"
    if note:
        prompt += f"用户备注：{note}\n"

    prompt += """
请直接输出建议内容，不要加引号、标题或任何格式标记。只输出纯文本建议。"""
    return prompt


def determine_suggestion_type(content_type: str, suggestion_text: str) -> str:
    """Determine the suggestion type based on content type and generated text.

    This is a heuristic classification. The LLM may naturally produce different
    types of suggestions. We do a simple keyword-based classification.

    Args:
        content_type: "text" or "link".
        suggestion_text: The generated suggestion text.

    Returns:
        One of: emotion_support, knowledge_expand, action_suggest, connection, general.
    """
    text = suggestion_text.lower()

    # Text content type heuristics
    if content_type == "text":
        if any(k in text for k in ["辛苦", "累", "难过", "不开心", "安慰", "抱抱", "感恩", "微笑"]):
            return "emotion_support"
        if any(k in text for k in ["学习", "知识", "笔记", "关联", "专题", "深入", "领域"]):
            return "knowledge_expand"
        if any(k in text for k in ["灵感", "创意", "idea", "时间胶囊", "行动", "试试", "建议"]):
            return "action_suggest"
        return "general"

    # Link content type heuristics
    if content_type == "link":
        if any(k in text for k in ["关联", "专题", "系列", "之前", "笔记", "相关"]):
            return "connection"
        if any(k in text for k in ["建议", "行动", "优先级", "时间", "周末", "安排"]):
            return "action_suggest"
        if any(k in text for k in ["趋势", "风格", "发现", "对比", "很像"]):
            return "knowledge_expand"
        return "general"

    return "general"
