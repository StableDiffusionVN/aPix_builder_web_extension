function basicAuthHeader(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

export function parseComfyTarget(rawAddress) {
  const input = String(rawAddress || "http://127.0.0.1:8188").trim().replace(/\/+$/, "");
  let value = input;
  if (!/^https?:\/\//i.test(value)) {
    const parts = value.split(":");
    if (value.includes("@")) {
      value = `http://${value}`;
    } else if (parts.length === 3 && !/^\d+$/.test(parts[1])) {
      value = `http://${encodeURIComponent(parts[1])}:${encodeURIComponent(parts[2])}@${parts[0]}`;
    } else {
      value = `http://${value}`;
    }
  }

  const url = new URL(value);
  const username = decodeURIComponent(url.username || "");
  const password = decodeURIComponent(url.password || "");
  const authHeaders = username || password
    ? { authorization: basicAuthHeader(username, password) }
    : {};
  const authPart = username || password
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    : "";

  return {
    input,
    httpBase: url.origin,
    label: `${url.protocol}//${authPart}${url.host}`,
    authHeaders,
    hostname: url.hostname,
    isLocal: url.hostname === "localhost" || url.hostname === "127.0.0.1"
  };
}

export function buildComfyUrlCandidates(target) {
  if (!target.isLocal) return [target.httpBase];

  const parsed = new URL(target.httpBase);
  const port = parsed.port ? `:${parsed.port}` : "";
  const protocol = parsed.protocol;
  return [
    `${protocol}//127.0.0.1${port}`,
    `${protocol}//localhost${port}`
  ].filter((value, index, array) => array.indexOf(value) === index);
}

export function sanitizeComfyFetchUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.username = "";
  url.password = "";
  return url.toString();
}
