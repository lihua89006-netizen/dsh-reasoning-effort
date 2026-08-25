/**
 * Reasoning-effort copy: zh-first dictionaries with a complete English
 * key-set, registered through ctx.locale and rendered by a dependency-free
 * lookup (document language), so the control bar needs no locale service
 * subscription.
 */

/** zh dictionary (key-set source of truth). */
export const zh = {
  'bar.loading': '推理等级: …',
  'bar.label': '推理等级',
  'bar.default': '默认（不覆盖）',
  'bar.custom': '自定义…',
  'bar.customOption': '自定义: {effort}',
  'bar.customPlaceholder': '输入 effort 值',
  'bar.apply': '应用',
  'bar.current': '当前: {effort}',
  'bar.currentDefault': '当前: 默认',
  'bar.noRoute': '（尚未发起模型请求）',
  'bar.error': '推理等级服务不可用：{error}',
} as const

/** English dictionary: same key set as zh. */
export const en: Record<keyof typeof zh, string> = {
  'bar.loading': 'Reasoning: …',
  'bar.label': 'Reasoning effort',
  'bar.default': 'Default (no override)',
  'bar.custom': 'Custom…',
  'bar.customOption': 'Custom: {effort}',
  'bar.customPlaceholder': 'Enter effort value',
  'bar.apply': 'Apply',
  'bar.current': 'Current: {effort}',
  'bar.currentDefault': 'Current: default',
  'bar.noRoute': '(no model request yet)',
  'bar.error': 'Reasoning-effort service unavailable: {error}',
}

export type ReasoningEffortKey = keyof typeof zh

/** Pick the dictionary for a document language tag (zh-prefixed → zh, else en). */
export function dictFor(lang: string | undefined): Record<ReasoningEffortKey, string> {
  return (lang ?? '').toLowerCase().startsWith('zh') ? zh : en
}

/** Build a translator over one dictionary with {param} substitution. */
export function translate(
  dict: Record<ReasoningEffortKey, string>,
): (key: ReasoningEffortKey, params?: Record<string, string>) => string {
  return (key, params) => {
    let text = dict[key]
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replaceAll(`{${name}}`, value)
    }
    return text
  }
}
