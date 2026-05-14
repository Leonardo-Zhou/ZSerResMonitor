import { readFile, writeFile } from "node:fs/promises";

const packageJsonPath = new URL("../package.json", import.meta.url);
const tauriConfigPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const cargoTomlPath = new URL("../src-tauri/Cargo.toml", import.meta.url);

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const version = packageJson.version;

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid package.json version: ${version}`);
}

const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
tauriConfig.version = version;
await writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoToml = await readFile(cargoTomlPath, "utf8");
const nextCargoToml = cargoToml.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${version}$2`);

if (nextCargoToml === cargoToml && !cargoToml.includes(`version = "${version}"`)) {
  throw new Error("Could not update src-tauri/Cargo.toml package version");
}

await writeFile(cargoTomlPath, nextCargoToml);
console.log(`Synced app version to ${version}`);
