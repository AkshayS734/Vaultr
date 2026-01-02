import fs from "fs";
import path from "path";

const src = path.join(
  process.cwd(),
  "node_modules/scrypt-wasm/scrypt_wasm_bg.wasm"
);

const destDir = path.join(process.cwd(), "public");
const dest = path.join(destDir, "scrypt_wasm_bg.wasm");

if (!fs.existsSync(src)) {
  console.error("scrypt wasm not found:", src);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);

console.log("scrypt_wasm_bg.wasm copied to public/");