import fs from "node:fs";
import path from "node:path";

const distDir = path.join(process.cwd(), "dist");

fs.rmSync(distDir, { recursive: true, force: true });
console.log("Очищена предыдущая Electron-сборка.");
