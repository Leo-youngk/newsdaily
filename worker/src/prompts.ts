// AI 提示词：摘要与翻译（与 plan.md 规格一致）

export const SUMMARY_SYSTEM =
  '你是一个中文资讯摘要助手。阅读用户提供的文章正文，输出 2-4 句简体中文摘要，' +
  '覆盖核心事实与结论，不添加原文没有的信息，不使用第一人称，总长度不超过 180 字。' +
  '只输出摘要正文，不要任何前缀、标题或解释。';

export const TRANSLATE_SYSTEM =
  '你是一个科技/财经领域的中英翻译助手。将用户提供的文本翻译成流畅的简体中文，' +
  '科技与财经术语采用通用中文译法，专有名词（公司、产品、人名、模型名）首次出现时用括号附原文，' +
  '例如「大型语言模型（LLM）」。只输出译文，不要任何解释或额外内容。';

export function buildSummaryUserPrompt(text: string, maxLength = 180): string {
  const clipped = text.slice(0, 12000);
  return `请为以下文章生成不超过 ${maxLength} 字的中文摘要：\n\n${clipped}`;
}

export function buildTranslateUserPrompt(text: string): string {
  const clipped = text.slice(0, 12000);
  return `请翻译以下内容为简体中文：\n\n${clipped}`;
}

export const BATCH_TRANSLATE_SYSTEM =
  '你是一个专业的科技与商业访谈中英翻译助手。' +
  '将用户提供的按编号标记的英文段落翻译成地道、流畅的简体中文，保持人名、公司名、专业术语的准确性。' +
  '输出必须严格保留原有的编号标记（如「[0] 译文」），每个编号对应一段。' +
  '不要合并段落，不要遗漏任何段落编号，不要输出任何额外的说明或前缀。';

export function buildBatchTranslatePrompt(paragraphs: string[]): string {
  const lines = paragraphs.map((p, i) => `[${i}] ${p.replace(/\r?\n+/g, ' ').trim()}`);
  return `请将以下 ${paragraphs.length} 个段落逐段翻译为简体中文，并严格按照 [编号] 格式输出：\n\n${lines.join('\n')}`;
}

export function parseBatchTranslateResponse(response: string, expectedCount: number): string[] {
  const result: string[] = new Array(expectedCount).fill('');
  const lines = response.split('\n');
  let currentIdx = -1;
  let currentText = '';

  for (const line of lines) {
    const match = line.match(/^\s*\[(\d+)\]\s*(.*)$/);
    if (match) {
      if (currentIdx >= 0 && currentIdx < expectedCount) {
        result[currentIdx] = currentText.trim();
      }
      currentIdx = parseInt(match[1], 10);
      currentText = match[2] || '';
    } else if (currentIdx >= 0) {
      currentText += (currentText ? ' ' : '') + line.trim();
    }
  }
  if (currentIdx >= 0 && currentIdx < expectedCount) {
    result[currentIdx] = currentText.trim();
  }

  // 兜底：如果由于某种原因某些段落为空，直接用原文兜底或保留空字符
  return result;
}

