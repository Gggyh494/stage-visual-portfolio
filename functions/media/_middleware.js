export async function onRequest({ request, next }) {
  const asset = await next();
  if (asset.status !== 200 || !/^video\/(?:mp4|webm)(?:;|$)/i.test(asset.headers.get("Content-Type") || "")) {
    return asset;
  }

  const headers = new Headers(asset.headers);
  headers.set("Accept-Ranges", "bytes");
  const range = /^bytes=(\d*)-(\d*)$/i.exec(request.headers.get("Range") || "");
  const validator = request.headers.get("If-Range");
  const current = !validator || (!validator.startsWith("W/") &&
    [headers.get("ETag"), headers.get("Last-Modified")].includes(validator));
  if (request.method !== "GET" || !range || !(range[1] || range[2]) || !current) {
    return new Response(asset.body, { headers });
  }

  // Pages currently supplies the full static asset. Send only the requested bytes to the browser.
  const bytes = await asset.arrayBuffer();
  const size = bytes.byteLength;
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  headers.delete("Content-Encoding");
  headers.delete("Content-Length");
  if (start > end || start >= size) {
    headers.set("Content-Range", "bytes */" + size);
    return new Response(null, { status: 416, headers });
  }
  const body = new Uint8Array(bytes, start, end - start + 1);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(body.byteLength));
  return new Response(body, { status: 206, headers });
}
