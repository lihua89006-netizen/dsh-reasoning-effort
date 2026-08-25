/**
 * Reasoning-effort copy: zh-first dictionaries with a complete English
 * key-set, rendered by a dependency-free lookup (document language), so the
 * control chip needs no locale service subscription.
 */

/** zh dictionary (key-set source of truth). */
export const zh = {
  'trigger.label': '推理等级',
  'menu.aria': '推理等级选择',
  'menu.default': '默认（不覆盖）',
  'menu.customPlaceholder': '输入 effort 值',
  'menu.apply': '应用',
} as const

/** English dictionary: same key set as zh. */
export const en: Record<keyof typeof zh, string> = {
  'trigger.label': 'Reasoning',
  'menu.aria': 'Reasoning effort selection',
  'menu.default': 'Default (no override)',
  'menu.customPlaceholder': 'Enter effort value',
  'menu.apply': 'Apply',
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
