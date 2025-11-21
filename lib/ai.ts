type ModelChoice = "grok" | "openai" | "fallback";

interface MarketSnapshot {
  symbol: string;
  price: number;
  change24h?: number;
  volume?: number;
}

export interface SwingSignal {
  symbol: string;
  thesis: string;
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
  source: ModelChoice;
}

async function callGrok(prompt: string) {
  const key = process.env.GROK_API_KEY;
  if (!key) return null;

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "grok-beta",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: "You are ApexPulse, an institutional swing trader. Respond in JSON."
        },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!res.ok) {
    throw new Error("Grok request failed");
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return content as string;
}

async function callOpenAI(prompt: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "You are ApexPulse, an institutional swing trader. Respond in JSON." },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!res.ok) {
    throw new Error("OpenAI request failed");
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content as string;
}

function fallbackSignals(): SwingSignal[] {
  const symbols = ["BTC", "ETH", "SOL", "LINK", "ATOM"];
  return symbols.map((s, i) => ({
    symbol: s,
    thesis: `${s} momentum intact; watch liquidity pockets for a clean swing.`,
    confidence: 70 - i * 5,
    stopLoss: 4 + i,
    takeProfit: 9 + i * 2,
    source: "fallback"
  }));
}

function parseSignals(raw: string, source: ModelChoice): SwingSignal[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        symbol: item.symbol || item.ticker,
        thesis: item.thesis || item.reason || "Algorithmic edge.",
        confidence: Number(item.confidence || 70),
        stopLoss: item.stopLoss ? Number(item.stopLoss) : undefined,
        takeProfit: item.takeProfit ? Number(item.takeProfit) : undefined,
        source
      }));
    }
    return fallbackSignals();
  } catch (error) {
    console.warn("AI parse fallback", error);
    return fallbackSignals();
  }
}

export async function generateSwingSignals(
  snapshot: MarketSnapshot[]
): Promise<SwingSignal[]> {
  const prompt = `Generate 5 JSON swing trade ideas for the next 24-72h. Keys: symbol, thesis, confidence (0-100), stopLoss (pct), takeProfit (pct). Market snapshot: ${JSON.stringify(
    snapshot.slice(0, 12)
  )}`;

  try {
    const grok = await callGrok(prompt);
    if (grok) return parseSignals(grok, "grok");
  } catch (error) {
    console.error("Grok error, falling back", error);
  }

  try {
    const openai = await callOpenAI(prompt);
    if (openai) return parseSignals(openai, "openai");
  } catch (error) {
    console.error("OpenAI error, falling back", error);
  }

  return fallbackSignals();
}
