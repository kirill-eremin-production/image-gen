import fs, { constants } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readPackageJson() {
  const packagePath = path.join(__dirname, "../package.json");
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

function findLatestDmgFile(distDir) {
  const entries = fs
    .readdirSync(distDir)
    .filter((name) => name.endsWith(".dmg") && !name.endsWith(".dmg.blockmap"));

  if (!entries.length) {
    throw new Error("Не найден ни один DMG-файл сборки в папке dist.");
  }

  return entries
    .map((name) => ({ name, mtime: fs.statSync(path.join(distDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0].name;
}

function findAppBundle(dir, depth = 0) {
  if (depth > 4) return null;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    if (entry.name.endsWith(".app")) {
      return path.join(dir, entry.name);
    }

    const nested = findAppBundle(path.join(dir, entry.name), depth + 1);
    if (nested) return nested;
  }

  return null;
}

function findBuiltAppInDist(distDir, fallbackAppName) {
  const preferredDirs = [
    path.join(distDir, "mac-arm64"),
    path.join(distDir, "mac-x64"),
    path.join(distDir, "mac"),
    path.join(distDir, "mac-universal"),
  ];

  const possibleNames = [`${fallbackAppName}.app`, "Image Generator.app"].filter(Boolean);

  for (const dir of preferredDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }

    if (!fs.statSync(dir).isDirectory()) {
      continue;
    }

    for (const name of possibleNames) {
      const directCandidate = path.join(dir, name);
      if (fs.existsSync(directCandidate) && fs.statSync(directCandidate).isDirectory()) {
        return directCandidate;
      }
    }

    const nested = findAppBundle(dir, 0);
    if (nested) {
      return nested;
    }
  }

  return findAppBundle(distDir, 1);
}

function ensureWritableApplications() {
  try {
    fs.accessSync("/Applications", constants.W_OK);
  } catch {
    throw new Error(
      "Нет прав на запись в /Applications. Запустите команду установки с правами администратора"
    );
  }
}

function safeRemove(pathToRemove) {
  if (!fs.existsSync(pathToRemove)) {
    return;
  }

  try {
    fs.rmSync(pathToRemove, { recursive: true, force: true });
    return;
  } catch (error) {
    throw new Error(
      `Не удалось удалить старую версию: ${pathToRemove}. Закройте приложение и повторите установку. (${error.message})`
    );
  }
}

function moveAppBundle(source, destination) {
  const sourceBasename = path.basename(source);

  try {
    fs.renameSync(source, destination);
    return;
  } catch (error) {
    const canFallback = ["EXDEV", "EPERM", "EISDIR", "ENOENT", "EACCES"].includes(error.code);
    if (!canFallback) {
      throw new Error(
        `Не удалось переместить .app с помощью rename (${sourceBasename} -> ${path.basename(destination)}): ${error.message}`
      );
    }
    console.log(`Перенос через rename не сработал (${error.code}), используем копирование.`);
  }

  try {
    execFileSync("ditto", ["-rsrc", source, destination], { stdio: "inherit" });
    return;
  } catch (error) {
    throw new Error(
      `Не удалось перенести .app в /Applications (ditto): ${error.message}`
    );
  }
}

function installAppBundle({ sourceAppPath, sourceLabel, configuredAppName }) {
  const bundleName = path.basename(sourceAppPath);
  const targetByBundle = path.join("/Applications", bundleName);
  const targetByConfig = path.join("/Applications", `${configuredAppName}.app`);

  ensureWritableApplications();

  const toDelete = new Set([targetByBundle, targetByConfig]);
  for (const destination of toDelete) {
    safeRemove(destination);
  }

  moveAppBundle(sourceAppPath, targetByBundle);

  if (!fs.existsSync(targetByBundle)) {
    throw new Error(
      `Перенос завершен, но приложение не найдено в /Applications по пути: ${targetByBundle}`
    );
  }

  console.log(`Установлено: ${bundleName} -> /Applications (источник: ${sourceLabel}).`);
  console.log("Удалена старая версия (если была) и выполнена установка новой сборки.");
}

function installMac() {
  const root = path.join(process.cwd(), "dist");
  if (!fs.existsSync(root)) {
    throw new Error("Папка dist не найдена. Сначала соберите приложение.");
  }

  const packageJson = readPackageJson();
  const buildConfig =
    typeof packageJson.build === "object" && packageJson.build !== null
      ? packageJson.build
      : {};

  const appName =
    (typeof buildConfig.productName === "string" && buildConfig.productName.trim()) ||
    (typeof packageJson.name === "string" && packageJson.name) ||
    "Image Generator";

  const unpackedAppPath = findBuiltAppInDist(root, appName);
  if (unpackedAppPath) {
    installAppBundle({
      sourceAppPath: unpackedAppPath,
      sourceLabel: path.relative(root, unpackedAppPath),
      configuredAppName: appName,
    });
    return;
  }

  const dmgName = findLatestDmgFile(root);
  const dmgPath = path.join(root, dmgName);

  const mountPoint = fs.mkdtempSync(path.join(os.tmpdir(), "image-generator-dmg-"));

  try {
    execFileSync("hdiutil", [
      "attach",
      "-nobrowse",
      "-readonly",
      "-mountpoint",
      mountPoint,
      dmgPath,
    ], {
      stdio: "inherit",
    });

    const expectedDirName = path.basename(dmgName, path.extname(dmgName));
    const appPath =
      findAppBundle(mountPoint) ||
      findAppBundle(path.join(mountPoint, expectedDirName));

    if (!appPath) {
      throw new Error("Не найден .app внутри DMG.");
    }

    installAppBundle({
      sourceAppPath: appPath,
      sourceLabel: dmgName,
      configuredAppName: appName,
    });
  } finally {
    try {
      execFileSync("hdiutil", ["detach", mountPoint, "-quiet"], { stdio: "inherit" });
    } catch {
      // Игнорируем ошибки открепления — это не должно ломать сборку целиком.
    }

    try {
      fs.rmdirSync(mountPoint);
    } catch {
      // Cleanup fallback.
    }
  }
}

function main() {
  if (process.platform !== "darwin") {
    console.log("Авто-установка из DMG поддерживается только на macOS.");
    return;
  }

  installMac();
}

main();
