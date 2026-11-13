import { readFileSync } from "node:fs";
import ts from "typescript";

for (const file of [
  "supabase/functions/platform-business-access/index.ts",
  "supabase/functions/platform-temporary-activation/index.ts",
]) {
  const source = readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length) {
    for (const diagnostic of errors) {
      console.error(file, ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
    process.exitCode = 1;
  } else {
    console.log(`PASS sintaxis de Edge Function: ${file}`);
  }
}
