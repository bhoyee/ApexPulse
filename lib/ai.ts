type ModelChoice = "openai" | "deepseek" | "fallback";

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
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  source: ModelChoice;
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

async function callDeepSeek(prompt: string) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.4,
      messages: [
        { role: "system", content: "You are ApexPulse, an institutional swing trader. Respond in JSON." },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!res.ok) {
    throw new Error("DeepSeek request failed");
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content as string;
}

function fallbackSignals(): SwingSignal[] {
  const ideas = [
    { symbol: "PEPE", entryPrice: 0.0000012, thesis: "Meme liquidity grinding higher; scalp breakouts only." },
    { symbol: "WIF", entryPrice: 1.2, thesis: "SOL memecoin momentum; look for pullback entries." },
    { symbol: "BONK", entryPrice: 0.000034, thesis: "SOL meme bid intact; trade VWAP reclaim setups." },
    { symbol: "FLOKI", entryPrice: 0.00025, thesis: "Rotates with meme beta; monitor funding and perp OI." },
    { symbol: "DOGS", entryPrice: 0.018, thesis: "SOL meme rotations; thin books—use hard stops." },
    { symbol: "JUP", entryPrice: 0.85, thesis: "SOL infra token; watch DEX volume + unlock calendar." },
    { symbol: "PYTH", entryPrice: 0.36, thesis: "Oracle flows; look for volume-led breakouts on SOL DEXs." },
    { symbol: "TIA", entryPrice: 1.95, thesis: "Rollapp infra; momentum if BTC steady, under $2 clip sizes." },
    { symbol: "SUI", entryPrice: 1.1, thesis: "Ecosystem growth; buy dips to prior HVN, manage risk." },
    { symbol: "WOO", entryPrice: 0.32, thesis: "CeFi+DeFi hybrid; trade range breaks with tight invalidation." }
  ];
  return ideas.map((idea, i) => ({
    symbol: idea.symbol,
    entryPrice: idea.entryPrice,
    thesis: idea.thesis,
    confidence: 75 - i,
    stopLoss: 4 + i * 0.5,
    takeProfit: 9 + i,
    source: "fallback"
  }));
}

export function parseSignals(raw: string, source: ModelChoice): SwingSignal[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        symbol: item.symbol || item.ticker,
        thesis: item.thesis || item.reason || "Algorithmic edge.",
        confidence: Number(item.confidence || 70),
        entryPrice: item.entry || item.entryPrice ? Number(item.entry ?? item.entryPrice) : undefined,
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
  const prompt = `Generate EXACTLY 10 JSON swing trade ideas for the next 24-72h:
- First 5 entries: memecoins under $2 with swing potential (avoid BTC/ETH/large caps).
- Next 5 entries: newly launched/low-cap tokens on Solana or BSC under $2 with momentum potential.
- Keys per object: symbol, entryPrice (USD), thesis (1-2 sentences), confidence (0-100), stopLoss (pct), takeProfit (pct).
Return as a pure JSON array (no prose). Price cap: < $2. Prefer coins that can realistically 2x on momentum.
Market snapshot: ${JSON.stringify(snapshot.slice(0, 12))}`;

  try {
    const openai = await callOpenAI(prompt);
    if (openai) return parseSignals(openai, "openai");
  } catch (error) {
    console.error("OpenAI error, falling back", error);
  }

  try {
    const ds = await callDeepSeek(prompt);
    if (ds) return parseSignals(ds, "deepseek");
  } catch (error) {
    console.error("DeepSeek error, falling back", error);
  }

  return fallbackSignals();
}
