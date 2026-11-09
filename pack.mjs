import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const base = resolve(root, "docs");
const read = (file) => readFile(resolve(base, file), "utf8");
const [html, css, json, app] = await Promise.all([
  read("index.html"), read("styles.css"), read("portfolio.json"), read("app.js"),
]);
const types = {
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".avif": "image/avif", ".gif": "image/gif",
  ".mp4": "video/mp4", ".webm": "video/webm",
};
const assets = {};
async function collect(directory) {
  const entries = await readdir(resolve(base, directory), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const key = directory + "/" + entry.name;
    if (entry.isDirectory()) { await collect(key); continue; }
    const mime = types[extname(entry.name).toLowerCase()];
    if (!entry.isFile() || !mime) continue;
    assets[key] = "data:" + mime + ";base64," + (await readFile(resolve(base, key))).toString("base64");
  }
}
await collect("media");
const script = (source) => "<script>\n" + source.replace(/<\/script/gi, "<\\/script") + "\n</script>";
const bundled = html
  .replace('<link rel="stylesheet" href="styles.css">', () => "<style>\n" + css + "\n</style>")
  .replace('<script src="app.js"></script>', () => script(
    "window.PORTFOLIO_MEDIA = " + JSON.stringify(assets) + ";\n" +
    "window.PORTFOLIO = " + JSON.stringify(JSON.parse(json)) + ";\n" + app,
  ));
const output = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "preview.html");
await writeFile(output, bundled, "utf8");
console.log(output);
