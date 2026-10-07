import { encode, decode } from "/opt/tools/figwright/lib/node_modules/@figwright/mcp/node_modules/@msgpack/msgpack/dist.esm/index.mjs";

const LEADER_URL = "http://127.0.0.1:3055";

export async function ping() {
  const res = await fetch(`${LEADER_URL}/ping`);
  if (!res.ok) throw new Error(`Ping failed: ${res.statusText}`);
  return await res.json();
}

export async function callTool(toolName, args = {}) {
  const status = await ping();
  if (!status.activeSessionId) {
    throw new Error("No active Figma plugin session connected!");
  }

  const req = {
    requestId: "req-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
    toolName,
    args,
    sessionId: status.activeSessionId,
    buildId: status.buildId
  };

  const bodyBytes = encode(req);
  const res = await fetch(`${LEADER_URL}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/msgpack" },
    body: Buffer.from(bodyBytes.buffer, bodyBytes.byteOffset, bodyBytes.byteLength)
  });

  const resBuf = new Uint8Array(await res.arrayBuffer());
  const decoded = decode(resBuf);
  if (decoded.kind === "err") {
    throw new Error(`Tool ${toolName} failed [${decoded.code}]: ${decoded.message}`);
  }
  return decoded.result;
}

export async function batch(ops) {
  return await callTool("batch", { ops });
}
