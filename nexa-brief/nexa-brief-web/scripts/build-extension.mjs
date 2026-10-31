import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(scriptDir, "..");
const extensionDir = resolve(webDir, "extension/nexa-connect");
const output = resolve(webDir, "public/downloads/nexa-connect.zip");
await mkdir(dirname(output), { recursive: true });

const python = `
import pathlib, sys, zipfile
source = pathlib.Path(sys.argv[1])
destination = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(source.rglob("*")):
        if path.is_file():
            archive.write(path, pathlib.PurePosixPath("nexa-connect") / path.relative_to(source).as_posix())
`;
const result = spawnSync("python3", ["-c", python, extensionDir, output], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
process.stdout.write(`Built ${output}\n`);

