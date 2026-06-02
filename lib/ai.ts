/**
 * lib/ai.ts — Unified AI client
 * Reads provider config from `ai_settings` table (falls back to env vars).
 * Injects `ai_training_docs` into system prompts when withTraining=true.
 * Supports: Gemini | Groq | Anthropic | OpenAI | Ollama
 */

import { supabaseAdmin } from './supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

export type AiProvider = 'gemini' | 'ollama' | 'openai' | 'groq' | 'anthropic';

export interface AiConfig {
  provider: AiProvider;
  model: string;
  base_url?: string;
  api_key?: string;
}

export interface AiMsg { role: 'user' | 'model'; text: string }

// ─── Config + training context ────────────────────────────────────────────────

export async function getAiConfig(): Promise<AiConfig> {
  try {
    const { data } = await supabaseAdmin
      .from('ai_settings')
      .select('provider, model, base_url, api_key')
      .eq('is_active', true)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        provider: data.provider as AiProvider,
        model: data.model,
        base_url: data.base_url ?? undefined,
        api_key: data.api_key ?? undefined,
      };
    }
  } catch { /* table not yet created — fall through */ }

  return { provider: 'gemini', model: 'gemini-2.0-flash' };
}

export async function getTrainingContext(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('ai_training_docs')
      .select('title, category, content')
      .eq('is_active', true)
      .order('category');

    if (!data || data.length === 0) return '';

    const LABELS: Record<string, string> = {
      brand_guidelines: 'BRAND GUIDELINES',
      client_info: 'CLIENT INFO',
      workflow: 'WORKFLOW & SOPs',
      creative_direction: 'CREATIVE DIRECTION',
      general: 'GENERAL',
    };

    return (
      '\n\n--- CUSTOM KNOWLEDGE BASE (always apply this context) ---\n' +
      data
        .map(d => `[${LABELS[d.category] ?? d.category}] ${d.title}:\n${d.content}`)
        .join('\n\n')
    );
  } catch {
    return '';
  }
}

// ─── Rate-limit error ─────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  retrySeconds: number;
  constructor(seconds: number) {
    super('rate_limited');
    this.retrySeconds = seconds;
    this.name = 'RateLimitError';
  }
}

function throwIfRateLimit(e: unknown): never {
  const err = e as { status?: number; message?: string; errorDetails?: { retryDelay?: string }[] };
  const status = err?.status ?? 500;
  const msg = err?.message ?? '';
  if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    const delayStr = err?.errorDetails?.find(d => d.retryDelay)?.retryDelay ?? '';
    throw new RateLimitError(parseInt(delayStr) || 30);
  }
  throw e;
}

// ─── Multi-turn chat (task-chat, global chat) ─────────────────────────────────

export async function aiChat(
  messages: AiMsg[],
  systemInstruction: string,
  withTraining = true
): Promise<string> {
  const config = await getAiConfig();
  const training = withTraining ? await getTrainingContext() : '';
  const system = systemInstruction + training;

  if (config.provider === 'gemini') return geminiChat(messages, system, config);
  if (config.provider === 'anthropic') return anthropicChat(messages, system, config);
  if (config.provider === 'groq') return openaiChat(messages, system, resolveGroqConfig(config));
  return openaiChat(messages, system, config);
}

// ─── Single-turn generation (caption, brief, map-columns) ────────────────────

export async function aiGenerate(
  prompt: string,
  withTraining = false
): Promise<string> {
  const config = await getAiConfig();
  const training = withTraining ? await getTrainingContext() : '';
  const fullPrompt = training ? `${training}\n\n${prompt}` : prompt;

  if (config.provider === 'gemini') return geminiGenerate(fullPrompt, config);
  if (config.provider === 'anthropic') return anthropicGenerate(fullPrompt, config);
  if (config.provider === 'groq') return openaiChat([{ role: 'user', text: fullPrompt }], '', resolveGroqConfig(config));
  return openaiChat([{ role: 'user', text: fullPrompt }], '', config);
}

// ─── Connection test ──────────────────────────────────────────────────────────

export async function testAiConnection(
  config: AiConfig
): Promise<{ ok: boolean; info?: string; error?: string }> {
  try {
    if (config.provider === 'ollama') {
      const base = (config.base_url ?? 'http://localhost:11434').replace(/\/$/, '');
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const models = ((data.models ?? []) as { name: string }[]).map(m => m.name);
      return { ok: true, info: `Connected. Models: ${models.slice(0, 5).join(', ')}` };
    }
    let reply: string;
    if (config.provider === 'anthropic') reply = await anthropicGenerate('Reply with only the word OK.', config);
    else if (config.provider === 'groq') reply = await openaiChat([{ role: 'user', text: 'Reply with only the word OK.' }], '', resolveGroqConfig(config));
    else reply = await aiGenerate('Reply with only the word OK.', false);
    return { ok: true, info: `${config.provider}/${config.model} → "${reply.slice(0, 60)}"` };
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message?.slice(0, 300) };
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function geminiChat(messages: AiMsg[], system: string, config: AiConfig): Promise<string> {
  const key = config.api_key || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API key not configured');

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: config.model, systemInstruction: system || undefined });

  const history = messages.slice(0, -1).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
  const last = messages[messages.length - 1].text;

  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(last);
    return result.response.text().trim();
  } catch (e) { throwIfRateLimit(e); throw e; }
}

async function geminiGenerate(prompt: string, config: AiConfig): Promise<string> {
  const key = config.api_key || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API key not configured');

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: config.model });

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (e) { throwIfRateLimit(e); throw e; }
}

// ─── Groq (OpenAI-compatible, free tier) ─────────────────────────────────────

function resolveGroqConfig(config: AiConfig): AiConfig {
  return {
    ...config,
    provider: 'openai',
    base_url: 'https://api.groq.com/openai',
    api_key: config.api_key || process.env.GROQ_API_KEY,
  };
}

// ─── Anthropic (Claude) ───────────────────────────────────────────────────────

async function anthropicChat(messages: AiMsg[], system: string, config: AiConfig): Promise<string> {
  const key = config.api_key || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Anthropic API key not configured');
  const client = new Anthropic({ apiKey: key });
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: system || undefined,
    messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
  });
  return ((response.content[0] as { text: string }).text ?? '').trim();
}

async function anthropicGenerate(prompt: string, config: AiConfig): Promise<string> {
  const key = config.api_key || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Anthropic API key not configured');
  const client = new Anthropic({ apiKey: key });
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  return ((response.content[0] as { text: string }).text ?? '').trim();
}

// ─── OpenAI-compatible (Ollama + OpenAI) ─────────────────────────────────────

async function openaiChat(messages: AiMsg[], system: string, config: AiConfig): Promise<string> {
  const base = (config.base_url ?? 'http://localhost:11434').replace(/\/$/, '');
  const url = `${base}/v1/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.api_key) headers['Authorization'] = `Bearer ${config.api_key}`;

  const body = JSON.stringify({
    model: config.model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.text,
      })),
    ],
    stream: false,
  });

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new RateLimitError(30);
    throw new Error(`${config.provider} error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}
