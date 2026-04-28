'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface TaskCtx {
  task_id: number;
  task_type: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const QUICK_DESIGN = [
  'Give me 3 creative concept ideas',
  'What visual style works for this platform?',
  'Suggest a color palette',
  'How should I structure the layout?',
];

const QUICK_POST = [
  'Write a caption for this post',
  'Suggest 10 hashtags',
  'Write a hook for the first line',
  'Best time to post on this platform?',
];

export function TaskAiChat({ task_id, task_type }: TaskCtx) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [retryIn, setRetryIn] = useState(0); // countdown seconds
  const bottomRef = useRef<HTMLDivElement>(null);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const quickPrompts = task_type === 'design' ? QUICK_DESIGN : QUICK_POST;

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Clear interval on unmount
  useEffect(() => () => {
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);
  }, []);

  function startCountdown(seconds: number) {
    setRetryIn(seconds);
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    retryTimerRef.current = setInterval(() => {
      setRetryIn(s => {
        if (s <= 1) {
          clearInterval(retryTimerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading || retryIn > 0) return;
    setInput('');

    const userMsg: Message = { role: 'user', text: msg };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    const res = await fetch('/api/ai/task-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id, message: msg, history: messages }),
    });

    if (res.ok) {
      const { reply } = await res.json();
      setMessages([...next, { role: 'model', text: reply }]);
    } else if (res.status === 429) {
      const { retrySeconds } = await res.json().catch(() => ({ retrySeconds: 30 }));
      setMessages(prev => prev.filter(m => m !== userMsg)); // remove optimistic user msg
      setInput(msg); // put text back in input
      startCountdown(retrySeconds ?? 30);
    } else {
      setMessages([...next, { role: 'model', text: '⚠️ Could not get a response. Please try again.' }]);
    }
    setLoading(false);
  }, [input, loading, retryIn, messages, task_id]);

  return (
    <div className="border-t pt-3 mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors w-full"
      >
        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0" />
        AI Assistant — ask about this task
        <span className="ml-auto text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {/* Quick prompts — only before first message */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={loading}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors text-left disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="max-h-52 overflow-y-auto flex flex-col gap-2 pr-1">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-xs rounded-xl px-3 py-2 whitespace-pre-wrap leading-relaxed max-w-[92%] ${
                    m.role === 'user'
                      ? 'self-end bg-primary text-primary-foreground'
                      : 'self-start bg-muted text-foreground'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {loading && (
                <div className="self-start text-xs bg-muted rounded-xl px-3 py-2 text-muted-foreground animate-pulse">
                  Thinking…
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Rate-limit notice */}
          {retryIn > 0 && (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              ⏳ AI rate limit reached. You can send again in <strong>{retryIn}s</strong>.
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Ask about this task… (Enter to send)"
              className="text-xs min-h-[52px] resize-none flex-1"
              disabled={loading || retryIn > 0}
            />
            <Button
              size="sm"
              onClick={() => send()}
              disabled={loading || retryIn > 0 || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white self-end disabled:opacity-50"
            >
              {loading ? '…' : retryIn > 0 ? `${retryIn}s` : 'Ask'}
            </Button>
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-muted-foreground hover:text-foreground self-start"
            >
              Clear chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}
