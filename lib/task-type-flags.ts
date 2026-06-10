import type { SupabaseClient } from '@supabase/supabase-js';

export interface TaskTypeDefinition {
  key: string;
  label: string;
  target_role: string;
  sort_order: number | null;
}

/**
 * Returns a map of task_type key → target_role, sourced from the task_types table.
 */
export async function getTaskTypeRoles(
  supabase: SupabaseClient,
): Promise<Record<string, string>> {
  const data = await getTaskTypes(supabase);
  const map: Record<string, string> = {};
  for (const row of data) {
    map[row.key] = row.target_role;
  }
  return map;
}

/** Returns the DB-backed task type catalog in display order. */
export async function getTaskTypes(
  supabase: SupabaseClient,
): Promise<TaskTypeDefinition[]> {
  const { data } = await supabase
    .from('task_types')
    .select('key, label, target_role, sort_order')
    .order('sort_order');
  return (data ?? []).map((row) => ({
    key: row.key as string,
    label: row.label as string,
    target_role: row.target_role as string,
    sort_order: row.sort_order as number | null,
  }));
}

export function getTaskTypeRolesMap(taskTypes: TaskTypeDefinition[]): Record<string, string> {
  return Object.fromEntries(taskTypes.map((taskType) => [taskType.key, taskType.target_role]));
}

export function getTaskTypeKeysForRoles(taskTypes: TaskTypeDefinition[], roleKeys: string[]): string[] {
  const roles = new Set(roleKeys);
  return taskTypes.filter((taskType) => roles.has(taskType.target_role)).map((taskType) => taskType.key);
}

export function getRoleKeysForTaskTypes(taskTypes: TaskTypeDefinition[]): string[] {
  return [...new Set(taskTypes.map((taskType) => taskType.target_role))];
}
