import type { SupabaseClient } from '@supabase/supabase-js';

export interface RoleFlags {
  is_designer_type: boolean;
  is_video_type:    boolean;
  is_privileged:    boolean;
  can_redistribute: boolean;
}

/** Fetch capability flags for one role. Call once per request, pass flags down. */
export async function getRoleFlags(
  supabase: SupabaseClient,
  role: string,
): Promise<RoleFlags> {
  const { data } = await supabase
    .from('roles')
    .select('is_designer_type, is_video_type, is_privileged, can_redistribute')
    .eq('key', role)
    .maybeSingle();
  return {
    is_designer_type: data?.is_designer_type ?? false,
    is_video_type:    data?.is_video_type    ?? false,
    is_privileged:    data?.is_privileged    ?? false,
    can_redistribute: data?.can_redistribute  ?? false,
  };
}

/** Return keys of all roles that are designer-type (graphic/visual design, NOT video). */
export async function getDesignerRoleKeys(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from('roles')
    .select('key')
    .eq('is_designer_type', true);
  return (data ?? []).map((r) => r.key as string);
}

/** Return keys of all roles that handle video production. */
export async function getVideoRoleKeys(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from('roles')
    .select('key')
    .eq('is_video_type', true);
  return (data ?? []).map((r) => r.key as string);
}

/** Return keys of all production roles (designer + video + smo). Use for capacity/team queries. */
export async function getProductionRoleKeys(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from('roles')
    .select('key')
    .or('is_designer_type.eq.true,is_video_type.eq.true,key.eq.smo');
  return (data ?? []).map((r) => r.key as string);
}
