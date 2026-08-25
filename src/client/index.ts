/**
 * Browser-half entry for the reasoning-effort plugin — runs inside the dsh web
 * GUI.
 *
 * The reasoning-effort control UI is intentionally disabled: level selection
 * happens entirely through the official model selector, which gains
 * selectable efforts for third-party routes once this plugin's
 * auto-provisioning declares `reasoningEfforts` (or the user declares them
 * manually). No composer chip is registered, so nothing extra renders — the
 * official UI stays untouched and there is no second place to pick a level.
 *
 * This entry stays as a no-op browser half (the `dsh.client` declaration keeps
 * the bundle loadable) so the plugin can be re-enabled from here if a
 * dedicated control is ever wanted again.
 */

/** Apply the browser half: nothing to mount by design (see module doc). */
export function apply(): void {}
