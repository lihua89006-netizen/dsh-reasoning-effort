#!/usr/bin/env node
/**
 * Link this plugin into the dsh profile's shared @zimu233l namespace
 * (~/.dsh/profiles/node_modules/@zimu233l/dsh-client-ui-reasoning-effort),
 * the layer the dsh loader resolves plugin rows from. Windows uses directory
 * junctions (symlinks require Developer Mode); the junction is replaced
 * whenever it points elsewhere and left alone when it is a real directory.
 *
 * Usage:
 *   node scripts/link-profile.mjs            # link/refresh
 *   node scripts/link-profile.mjs --dry-run  # report without changing
 */
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolvePath(SCRIPT_DIR, '..')
const PACKAGE_NAME = '@zimu233l/dsh-client-ui-reasoning-effort'

function report(msg) {
  console.log(`[link-profile] ${msg}`)
}

function main() {
  const DRY = process.argv.includes('--dry-run')
  const HOME = process.env.HOME || homedir()
  if (!HOME) {
    report('cannot determine home directory (HOME is unset and os.homedir() is empty)')
    process.exit(1)
  }
  const LINK_DIR = join(HOME, '.dsh', 'profiles', 'node_modules', '@zimu233l')
  const linkPath = join(LINK_DIR, PACKAGE_NAME.slice(PACKAGE_NAME.indexOf('/') + 1))
  const WIN32 = process.platform === 'win32'
  const target = WIN32 ? PROJECT_ROOT : linkPath

  if (!existsSync(LINK_DIR)) {
    if (DRY) { report(`would create link dir: ${LINK_DIR}`); process.exit(0) }
    mkdirSync(LINK_DIR, { recursive: true })
    report(`created link dir: ${LINK_DIR}`)
  }

  let existing = 'missing'
  let linkIsJunctionDir = false
  try {
    const st = lstatSync(linkPath)
    existing = st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'dir' : 'file'
    if (existing === 'symlink' && st.isDirectory()) linkIsJunctionDir = true
  } catch {}
  let current = null
  if (existing === 'symlink') {
    try { current = readlinkSync(linkPath) } catch {}
  }
  if (existing === 'missing') {
    if (DRY) { report(`would link ${PACKAGE_NAME} -> ${target}`); return }
    symlinkSync(target, linkPath, WIN32 ? 'junction' : undefined)
    report(`linked ${PACKAGE_NAME} -> ${target}`)
    return
  }
  if (existing === 'symlink') {
    if (current === target) {
      report('already linked correctly')
      return
    }
    if (DRY) { report(`would replace ${PACKAGE_NAME} -> ${current ?? '(broken)'}`); return }
    if (linkIsJunctionDir) rmdirSync(linkPath)
    else unlinkSync(linkPath)
    symlinkSync(target, linkPath, WIN32 ? 'junction' : undefined)
    report(`replaced ${PACKAGE_NAME} -> ${target} (was ${current ?? '(broken)'})`)
    return
  }
  report(`skipped (not a symlink, untouched): ${linkPath}`)
}

main()
