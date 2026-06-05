import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { AiSettingsPanel } from '@/components/admin/AiSettingsPanel';

export default async function AdminSettingsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager'].includes(profile.role)) redirect('/');

  // Fetch current AI settings (server-side, no API call needed)
  const { data: aiSettings } = await supabaseAdmin
    .from('ai_settings')
    .select('id, provider, model, base_url, api_key')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: trainingDocs } = await supabaseAdmin
    .from('ai_training_docs')
    .select('id, title, category, content, is_active, created_at, updated_at')
    .order('category')
    .order('title');

  type AiProvider = 'gemini' | 'groq' | 'anthropic' | 'openai' | 'ollama';

  const savedProvider = (aiSettings?.provider ?? 'gemini') as AiProvider;

  const envKeyMap: Record<AiProvider, boolean> = {
    gemini:    !!process.env.GEMINI_API_KEY,
    groq:      !!process.env.GROQ_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai:    !!process.env.OPENAI_API_KEY,
    ollama:    false,
  };

  const settings = aiSettings
    ? {
        provider: savedProvider,
        model: aiSettings.model,
        base_url: aiSettings.base_url ?? '',
        api_key: '',
        has_db_key: !!aiSettings.api_key,
        env_key_map: envKeyMap,
      }
    : {
        provider: 'gemini' as AiProvider,
        model: 'gemini-2.0-flash',
        base_url: '',
        api_key: '',
        has_db_key: false,
        env_key_map: envKeyMap,
      };

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">App Settings</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">AI provider configuration and knowledge base</p>
      </div>
      <AiSettingsPanel
        initialSettings={settings}
        initialDocs={(trainingDocs ?? []) as Parameters<typeof AiSettingsPanel>[0]['initialDocs']}
      />
    </div>
  );
}
