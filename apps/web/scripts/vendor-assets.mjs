// Copies the pdf.js worker and the tesseract.js worker, core and English data into
// public/vendor, so on-device scanning needs no third-party host and the CSP stays 'self'.
// Runs before `next dev` and `next build`; the output is gitignored.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(app, "package.json"));
const pkgDir = (name, from = require) => dirname(from.resolve(`${name}/package.json`));

const tesseract = pkgDir("tesseract.js");
const core = pkgDir("tesseract.js-core", createRequire(join(tesseract, "package.json")));
const files = [
  [join(pkgDir("pdfjs-dist"), "build/pdf.worker.min.mjs"), "pdfjs/pdf.worker.min.mjs"],
  [join(tesseract, "dist/worker.min.js"), "tesseract/worker.min.js"],
  // The LSTM engine only (tesseract's default); the worker picks the best build per browser.
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map(
    (f) => [join(core, f), `tesseract/core/${f}`],
  ),
  [join(pkgDir("@tesseract.js-data/eng"), "4.0.0_best_int/eng.traineddata.gz"), "tesseract/lang/eng.traineddata.gz"],
];

let copied = 0;
for (const [from, to] of files) {
  const dest = join(app, "public/vendor", to);
  if (existsSync(dest) && statSync(dest).size === statSync(from).size) continue;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(from, dest);
  copied++;
}
console.log(`vendor assets: ${copied} copied, ${files.length - copied} up to date`);
