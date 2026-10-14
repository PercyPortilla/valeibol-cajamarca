import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const parts = [
  "part-00",
  "part-01",
  "part-02a",
  "part-02b",
  "part-03",
  "part-04",
  "part-05",
  "part-06",
  "part-07",
  "part-08",
];

const marker = join(process.cwd(), "app", "page.tsx");

if (!existsSync(marker)) {
  const encoded = parts
    .map((name) => readFileSync(join(process.cwd(), ".bootstrap", name), "utf8").trim())
    .join("");

  const archive = join(process.cwd(), ".bootstrap", "runtime.tar.gz");
  writeFileSync(archive, Buffer.from(encoded, "base64"));
  execFileSync("tar", ["-xzf", archive, "-C", process.cwd()], { stdio: "inherit" });
  console.log("Valeibol runtime restored.");
}
