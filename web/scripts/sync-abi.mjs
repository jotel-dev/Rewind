import { readFile, mkdir, writeFile } from "node:fs/promises";
const artifact = JSON.parse(await readFile(new URL("../../contracts/artifacts/contracts/Rewind.sol/Rewind.json", import.meta.url), "utf8"));
if (artifact.contractName !== "Rewind" || !Array.isArray(artifact.abi)) throw new Error("Expected compiled Rewind ABI");
await mkdir(new URL("../src/abi/", import.meta.url), { recursive: true });
await writeFile(new URL("../src/abi/rewind.ts", import.meta.url), "// Copied from the compiled Rewind artifact. Regenerate with npm run abi.\nexport const rewindAbi = " + JSON.stringify(artifact.abi, null, 2) + " as const;\n");
