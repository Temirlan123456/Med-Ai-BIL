const U = process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.UPSTASH_REDIS_REST_TOKEN;
const cmd = (c) =>
  fetch(U, { method: "POST", headers: { Authorization: "Bearer " + T }, body: JSON.stringify(c) }).then((r) => r.json());
const cut = (v, n) => String(v ?? "").slice(0, n);

async function chat(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const prompt = cut(req.body && req.body.prompt, 2000);
  if (!prompt) return res.status(400).end();
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    const t = (d.content || []).map((c) => c.text || "").join("").replace(/```json|```/g, "").trim();
    res.status(200).json(JSON.parse(t));
  } catch (e) {
    res.status(500).json({ error: "chat_failed" });
  }
}

async function complaint(req, res) {
  if (req.method === "POST") {
    const b = req.body || {};
    if (!b.text) return res.status(400).end();
    const item = {
      name: cut(b.name, 80), cls: cut(b.cls, 20), text: cut(b.text, 500),
      zone: ["g", "y", "r"].includes(b.zone) ? b.zone : "?", info: cut(b.info, 600), at: Date.now(),
    };
    await cmd(["LPUSH", "complaints", JSON.stringify(item)]);
    await cmd(["LTRIM", "complaints", 0, 499]);
    return res.status(200).json({ ok: true });
  }
  if (req.method === "GET") {
    if (!process.env.DIRECTOR_PASSWORD || req.headers["x-pass"] !== process.env.DIRECTOR_PASSWORD)
      return res.status(401).end();
    const d = await cmd(["LRANGE", "complaints", 0, 199]);
    const items = (d.result || []).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
    return res.status(200).json({ items });
  }
  res.status(405).end();
}

export default async function handler(req, res) {
  if (req.query.a === "chat") return chat(req, res);
  if (req.query.a === "complaint") return complaint(req, res);
  res.status(404).end();
}
