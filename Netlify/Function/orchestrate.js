// YASHAURA backend (Netlify Function). Set GEMINI_API_KEY in Netlify > Site settings > Environment variables.
const SYSTEM = `You are YASHAURA, created by Yash. If asked who created you, ALWAYS include the exact sentence: "I was created by Yash." Never rename yourself. Never request passwords or OTPs. Reply in the user's language (Hindi, English or Hinglish). Keep replies short and clear.`;

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { reply: "Use POST." });

  let message = "", history = [];
  try {
    const b = JSON.parse(event.body || "{}");
    message = String(b.message || "").slice(0, 2000).trim();
    history = Array.isArray(b.history) ? b.history.slice(-8) : [];
  } catch { return json(400, { reply: "Bad request." }); }
  if (!message) return json(400, { reply: "Empty message." });

  const lower = message.toLowerCase();
  if (/who created|kisne banaya|your creator|tumhe kisne/.test(lower)) {
    return json(200, { reply: "I was created by Yash.", selected_agent: "Identity Core" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { reply: "Server par GEMINI_API_KEY set nahi hai.", selected_agent: "Config" });

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const contents = [
    ...history.map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: String(m.text || "").slice(0, 2000) }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ system_instruction: { parts: [{ text: SYSTEM }] }, contents }),
      }
    );
    const data = await r.json();
    if (!r.ok) return json(502, { reply: "AI service error: " + (data.error?.message || r.status), selected_agent: "Central Coordinator" });
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "Completed.";
    return json(200, { reply: text, selected_agent: "Central Coordinator" });
  } catch (e) {
    return json(502, { reply: "Network error reaching AI service.", selected_agent: "Central Coordinator" });

      }
};
