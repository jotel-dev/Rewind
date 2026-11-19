// Dependency-free source lint, alongside TypeScript's unused-symbol checks.
import ts from "typescript";
import { readdir, readFile } from "node:fs/promises";
const failures = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = new URL(entry.name, directory);
    if (entry.isDirectory()) { await walk(new URL(entry.name + "/", directory)); continue; }
    if (!/\.tsx?$/.test(entry.name)) continue;
    const source = await readFile(file, "utf8");
    const ast = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true, entry.name.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const fail = (node, reason) => failures.push(`${file.pathname}:${ast.getLineAndCharacterOfPosition(node.pos).line + 1} ${reason}`);
    function visit(node) {
      if (ts.isImportDeclaration(node) && /viem\/accounts|@qorechain\/sdk|contracts\/scripts/.test(node.moduleSpecifier.text)) fail(node, "Signing and server-only modules are forbidden in browser code.");
      if (ts.isPropertyAccessExpression(node) && /privateKey|mnemonic|secretKey|recoveryCode/.test(node.name.text)) fail(node, "Browser code must not access signing credentials.");
      if (ts.isJsxAttribute(node) && node.name.text === "dangerouslySetInnerHTML") fail(node, "Do not inject raw HTML.");
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === "img" && !node.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.text === "alt")) fail(node, "Images need alt text.");
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
}
await walk(new URL("../src/", import.meta.url));
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else console.log("Source lint passed: no browser signing modules/credentials, unsafe HTML or missing image alternatives.");
