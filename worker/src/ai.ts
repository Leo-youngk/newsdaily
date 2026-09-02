// Provider 抽象：OpenAI 兼容端点 + 主/备模型自动回退
// 借鉴 Karakeep 的 InferenceClientFactory 与 LiteLLM 的 fallback_models 思路

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiEnv {
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_FALLBACK_MODEL?: string;
}

export interface ChatResult {
  text: string;
  model: string;
}

function baseUrl(env: AiEnv): string {
  const b = (env.AI_BASE_URL ?? '').replace(/\/+$/, '');
  return b || 'https://api.openai.com/v1';
}

async function callModel(
  env: AiEnv,
  model: string,
  messages: ChatMessage[],
  timeoutMs = 45000,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl(env)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AI_API_KEY ?? ''}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`AI ${model} HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`AI ${model} 返回空内容`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** 主模型失败自动切备用模型 */
export async function chat(env: AiEnv, messages: ChatMessage[]): Promise<ChatResult> {
  if (!env.AI_API_KEY) throw new Error('未配置 AI_API_KEY');
  const primary = env.AI_MODEL || 'gpt-4o-mini';
  try {
    return { text: await callModel(env, primary, messages), model: primary };
  } catch (err) {
    const fallback = env.AI_FALLBACK_MODEL;
    if (!fallback || fallback === primary) throw err;
    return { text: await callModel(env, fallback, messages), model: fallback };
  }
}
