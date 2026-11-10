export function onRequest({ request, next }) {
  const url = new URL(request.url);
  try {
    url.pathname = decodeURIComponent(url.pathname).replace(/[\\/]+/g, "/");
  } catch {
    return next();
  }
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
    return new Response("Not Found", { status: 404 });
  }
  return next();
}
