// Runs the backend's contract export into ./bundle and records the backend
// commit in contract.lock.json (spec §13.3).
// Usage: pnpm contract:pull -- --from ../../../tenant-ecommerce-api [--no-openapi]
//
// The OpenAPI documents are re-exported from the current backend code by
// default. --no-openapi copies the backend's last exported documents
// instead, which may be stale.
import { execFileSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const fromIndex = args.indexOf("--from")

if (fromIndex === -1 || !args[fromIndex + 1]) {
  console.error(
    "Usage: pnpm contract:pull -- --from <path to tenant-ecommerce-api> [--no-openapi]"
  )
  process.exit(1)
}

const backend = resolve(args[fromIndex + 1])
const exportArgs = [
  "artisan",
  "frontend:contract",
  `--path=${join(root, "bundle")}`,
]

if (!args.includes("--no-openapi")) {
  exportArgs.push("--openapi")
}

// On Windows, php is often a .bat shim (Laravel Herd), which needs a shell.
execFileSync("php", exportArgs, { cwd: backend, stdio: "inherit", shell: process.platform === "win32" })

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: backend,
  encoding: "utf8",
}).trim()
const lockFile = join(root, "contract.lock.json")
let lock = {}

try {
  lock = JSON.parse(await readFile(lockFile, "utf8"))
} catch {
  // No lock yet; contract:generate writes the file hashes.
}

await writeFile(
  lockFile,
  JSON.stringify({ ...lock, backendCommit: commit }, null, 2) + "\n"
)
console.log(
  `Pulled the contract at backend commit ${commit}. Run pnpm contract:generate next.`
)
