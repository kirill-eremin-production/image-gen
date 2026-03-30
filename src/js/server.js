const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { exec } = require("child_process");

const API_KEY =
  "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";
const URL_API = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = {
  "gemini-3-pro": "google/gemini-3-pro-image-preview",
  "gemini-3.1-flash": "google/gemini-3.1-flash-image-preview",
};
const DEFAULT_MODEL = "gemini-3.1-flash";

// Проверяем, запущено ли приложение внутри Electron
const isElectron = process.versions.hasOwnProperty("electron");

let REFS_DIR, GENS_DIR, THREADS_FILE;

if (isElectron) {
  let userDataPath;
  if (process.platform === "win32") {
    userDataPath = path.join(process.env.APPDATA, "ImageGenerator");
  } else {
    userDataPath = path.join(
      process.env.HOME,
      "Library/Application Support/ImageGenerator"
    );
  }
  if (!fs.existsSync(userDataPath))
    fs.mkdirSync(userDataPath, { recursive: true });
  REFS_DIR = path.join(userDataPath, "references");
  GENS_DIR = path.join(userDataPath, "generated");
  THREADS_FILE = path.join(userDataPath, "threads.json");
} else {
  REFS_DIR = path.join(__dirname, "../../references");
  GENS_DIR = path.join(__dirname, "../../generated");
  THREADS_FILE = path.join(__dirname, "../../threads.json");
}

// Создаем папки, если их нет
if (!fs.existsSync(REFS_DIR)) fs.mkdirSync(REFS_DIR);
if (!fs.existsSync(GENS_DIR)) fs.mkdirSync(GENS_DIR);
if (!fs.existsSync(THREADS_FILE))
  fs.writeFileSync(THREADS_FILE, JSON.stringify([]));

function saveBase64Image(base64String, directory, prefix) {
  const matches = base64String.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return null;
  }

  const extension = matches[1];
  const data = matches[2];
  const buffer = Buffer.from(data, "base64");
  const filename = `${prefix}_${Date.now()}_${Math.floor(
    Math.random() * 1000
  )}.${extension}`;
  const filePath = path.join(directory, filename);

  fs.writeFileSync(filePath, buffer);
  return filename;
}

function getThreads() {
  try {
    const data = fs.readFileSync(THREADS_FILE, "utf8");
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveThreads(threads) {
  fs.writeFileSync(THREADS_FILE, JSON.stringify(threads, null, 2));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (req.method === "GET" && parsedUrl.pathname === "/") {
    fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading index.html");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } else if (req.method === "GET" && parsedUrl.pathname === "/files") {
    const type = parsedUrl.searchParams.get("type");
    const dir = type === "references" ? REFS_DIR : GENS_DIR;

    try {
      if (!fs.existsSync(dir)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify([]));
      }
      const files = fs
        .readdirSync(dir)
        .filter((file) => /\.(png|jpg|jpeg|gif|webp)$/i.test(file))
        .map((file) => ({
          name: file,
          url: `/view?type=${type}&name=${file}`,
        }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(files));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (req.method === "GET" && parsedUrl.pathname === "/view") {
    const type = parsedUrl.searchParams.get("type");
    const name = parsedUrl.searchParams.get("name");
    const dir = type === "references" ? REFS_DIR : GENS_DIR;
    const filePath = path.join(dir, name);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(name).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : "image/jpeg";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end();
    }
  } else if (req.method === "GET" && parsedUrl.pathname === "/reveal") {
    const type = parsedUrl.searchParams.get("type");
    const name = parsedUrl.searchParams.get("name");
    const dir = type === "references" ? REFS_DIR : GENS_DIR;
    const filePath = path.join(dir, name);

    if (fs.existsSync(filePath)) {
      const command =
        process.platform === "win32"
          ? `explorer /select,"${filePath}"`
          : `open -R "${filePath}"`;
      exec(command, (error) => {
        if (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(200);
          res.end("OK");
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  } else if (req.method === "DELETE" && parsedUrl.pathname === "/delete") {
    const type = parsedUrl.searchParams.get("type");
    const name = parsedUrl.searchParams.get("name");
    const dir = type === "references" ? REFS_DIR : GENS_DIR;
    const filePath = path.join(dir, name);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        res.writeHead(200);
        res.end("OK");
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  } else if (req.method === "GET" && parsedUrl.pathname === "/threads") {
    const threads = getThreads();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(threads));
  } else if (req.method === "DELETE" && parsedUrl.pathname === "/threads") {
    const id = parsedUrl.searchParams.get("id");
    if (id) {
      const threads = getThreads().filter((t) => t.id !== id);
      saveThreads(threads);
    } else {
      saveThreads([]);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  } else if (req.method === "POST" && parsedUrl.pathname === "/generate") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const { prompt, resolution, aspectRatio, references, threadId, model } =
          JSON.parse(body);
        const selectedModel = MODELS[model] || MODELS[DEFAULT_MODEL];
        const content = [];

        if (references && Array.isArray(references)) {
          for (const ref of references) {
            let base64Data = ref;
            if (ref.startsWith("/view")) {
              const refUrl = new URL(
                ref,
                `http://${req.headers.host || "localhost"}`
              );
              const type = refUrl.searchParams.get("type");
              const name = refUrl.searchParams.get("name");
              const dir = type === "references" ? REFS_DIR : GENS_DIR;
              const filePath = path.join(dir, name);

              if (fs.existsSync(filePath)) {
                const fileData = fs.readFileSync(filePath);
                const ext = path.extname(name).replace(".", "") || "png";
                base64Data = `data:image/${ext};base64,${fileData.toString(
                  "base64"
                )}`;
              } else {
                continue;
              }
            } else if (ref.startsWith("data:image")) {
              saveBase64Image(ref, REFS_DIR, "ref");
            }

            content.push({
              type: "image_url",
              image_url: { url: base64Data },
            });
          }
        }

        content.push({
          type: "text",
          text: prompt,
        });

        const payload = {
          model: selectedModel,
          messages: [{ role: "user", content: content }],
          modalities: ["image", "text"],
          image_config: { image_size: resolution, aspect_ratio: aspectRatio },
        };

        const response = await fetch(URL_API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        const savedImages = [];

        if (result.choices && result.choices[0].message.images) {
          result.choices[0].message.images.forEach((img) => {
            if (img.image_url && img.image_url.url.startsWith("data:image")) {
              const filename = saveBase64Image(
                img.image_url.url,
                GENS_DIR,
                "gen"
              );
              if (filename) {
                savedImages.push({
                  name: filename,
                  url: `/view?type=generated&name=${filename}`,
                });
              }
            }
          });
        }

        // Сохранение в историю (треды)
        const threads = getThreads();
        let currentThread;

        if (threadId) {
          currentThread = threads.find((t) => t.id === threadId);
        }

        if (!currentThread) {
          currentThread = {
            id: Date.now().toString(),
            title: prompt.substring(0, 30) + (prompt.length > 30 ? "..." : ""),
            history: [],
          };
          threads.push(currentThread);
        }

        const cost = result.usage && result.usage.cost != null ? result.usage.cost : null;

        currentThread.history.push({
          timestamp: new Date().toISOString(),
          prompt,
          resolution,
          aspectRatio,
          images: savedImages,
          cost,
        });

        saveThreads(threads);

        // Добавляем threadId в ответ, чтобы клиент знал, в каком треде он находится
        result.threadId = currentThread.id;

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error("Error:", error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
