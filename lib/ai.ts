type ModelChoice = "openai" | "deepseek" | "fallback";

interface MarketSnapshot {
  symbol: string;
  price: number;
  change24h?: number;
  volume?: number;
  quoteVolume?: number;
  high?: number;
  low?: number;
}

const MIN_CONFIDENCE = 80;

export interface SwingSignal {
  symbol: string;
  thesis: string;
  confidence: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  source: ModelChoice;
}

export async function callOpenAI(prompt: string, key?: string) {
  key = key || process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are ApexPulse, a disciplined institutional swing trader who only recommends trades backed by the concrete data you're given. You never invent tickers, and you never inflate confidence to fill a quota. Respond in JSON."
        },
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

export async function callDeepSeek(prompt: string, key?: string) {
  key = key || process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are ApexPulse, a disciplined institutional swing trader who only recommends trades backed by the concrete data you're given. You never invent tickers, and you never inflate confidence to fill a quota. Respond in JSON."
        },
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
  // If the LLM fails, return empty so it's obvious signals did not refresh.
  return [];
}

export function parseSignals(raw: string, source: ModelChoice): SwingSignal[] {
  try {
    const cleaned = raw
      .replace(/```json/gi, "```")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        symbol: String(item.symbol || item.ticker || "").toUpperCase().trim(),
        thesis: item.thesis || item.reason || "Algorithmic edge.",
        // No generous default here on purpose: if the model omits confidence,
        // it should be filtered out by the MIN_CONFIDENCE gate below rather
        // than silently passed through at an inflated score.
        confidence: Number(item.confidence ?? 0),
        entryPrice: item.entry || item.entryPrice ? Number(item.entry ?? item.entryPrice) : undefined,
        stopLoss: item.stopLoss ? Number(item.stopLoss) : undefined,
        takeProfit: item.takeProfit ? Number(item.takeProfit) : undefined,
        source
      }));
    }
    return fallbackSignals();
  } catch (error) {
    console.warn("AI parse failed", error);
    return fallbackSignals();
  }
}

export async function generateSwingSignals(
  snapshot: MarketSnapshot[],
  opts?: { openaiKey?: string; deepseekKey?: string }
): Promise<SwingSignal[]> {
  const candidates = snapshot.slice(0, 40);
  const validSymbols = new Set(candidates.map((c) => c.symbol.toUpperCase()));

  const prompt = `You are screening real, currently-liquid Binance USDT pairs for swing trades over the next 24-72h. This snapshot is the ONLY universe you may pick from -- never invent, guess, or reference a symbol that is not in this exact list. Every entry already has real live price/volume data; do not assume anything about a coin beyond what's given.

Market snapshot (symbol, price USD, change24h %, 24h volume, 24h high, 24h low):
${JSON.stringify(candidates)}

For each candidate you consider, run this due-diligence checklist using ONLY the data above:
1. Trend confirmation: is change24h clearly positive (active momentum), or is price basing near its 24h low after a selloff (mean-reversion setup)? State which case applies.
2. Liquidity: does the 24h volume support entering/exiting a swing position without excessive slippage?
3. Room to run: is price meaningfully below its 24h high (upside room), rather than already stretched at the top of its range?
4. Risk/reward: can you set a stopLoss and takeProfit (both as % from entry) where the reward is at least 1.5x the risk?

Score confidence 0-100 based strictly on how many of these 4 checks are clearly satisfied by the data -- not vibes, not general knowledge about the coin. Only include an idea in your response if confidence >= ${MIN_CONFIDENCE} AND at least 3 of the 4 checks pass. If nothing in the snapshot clears that bar, return an empty array. Do not lower your standard or invent reasons just to return more ideas -- an empty array is a valid, honest answer.

Return 0-5 ideas as a pure JSON array (no prose, no markdown fences). Each object:
{ "symbol": string (must exactly match a symbol from the snapshot), "thesis": string (2-3 sentences citing the specific change24h/volume/range numbers that justify the call), "confidence": number (${MIN_CONFIDENCE}-100 only), "entryPrice": number, "stopLoss": number (pct), "takeProfit": number (pct) }`;

  const vet = (signals: SwingSignal[]) =>
    signals.filter(
      (s) => s.confidence >= MIN_CONFIDENCE && validSymbols.has(s.symbol.toUpperCase())
    );

  try {
    const ds = await callDeepSeek(prompt, opts?.deepseekKey);
    if (ds) {
      const vetted = vet(parseSignals(ds, "deepseek"));
      if (vetted.length) return vetted;
    }
  } catch (error) {
    console.error("DeepSeek error, falling back to OpenAI", error);
  }

  try {
    const openai = await callOpenAI(prompt, opts?.openaiKey);
    if (openai) {
      const vetted = vet(parseSignals(openai, "openai"));
      if (vetted.length) return vetted;
    }
  } catch (error) {
    console.error("OpenAI error, falling back", error);
  }

  return fallbackSignals();
}

export interface ListingSignal {
  confidence: number;
  thesis: string;
  stopLossPct: number;
  takeProfitPct: number;
  source: ModelChoice;
}

export const MIN_LISTING_CONFIDENCE = 70;

// Unlike generateSwingSignals, there is no price/volume snapshot here -- the
// pair isn't trading yet. The AI can only reason from the announcement text
// and whatever it already knows about the project by name, which is a much
// weaker basis than real market data, so this is scored on its own,
// separate (and honestly labeled) confidence scale.
export async function generateListingSignal(
  listing: { symbol: string; pair: string; title: string; goLiveAt: Date | null },
  opts?: { openaiKey?: string; deepseekKey?: string }
): Promise<ListingSignal | null> {
  const prompt = `Binance has officially announced a new spot listing (this is a real, confirmed exchange announcement, not a rumor or leak): "${listing.title}". The trading pair is ${listing.pair}, going live at ${listing.goLiveAt?.toISOString() ?? "an unspecified time"}.

You have NO price history, volume, or chart data for this pair -- it is not trading yet, so this is not a technical setup. Base your assessment only on what you genuinely know about this specific project from its name/ticker (e.g. is it an established project you recognize being listed on a major exchange for the first time, versus a name you don't recognize at all). New listings are extremely volatile in their first hours and frequently spike then sell off hard -- state that risk explicitly regardless of your confidence level.

Score confidence 0-100 for whether this looks like a legitimate, established project worth a small speculative position. Only score above 70 if you have specific, genuine knowledge that this project is reputable/established -- if you don't recognize the project, confidence must be low (well under 50). Do not inflate confidence just to give an answer; low confidence is a valid, honest response for a project you don't know.

Return pure JSON (no prose, no markdown fences): { "confidence": number (0-100), "thesis": string (2-3 sentences: what you do or don't know about this project, plus the new-listing volatility risk), "stopLossPct": number (suggest wide, e.g. 15-25, given first-hours volatility), "takeProfitPct": number }`;

  const parseOne = (raw: string, source: ModelChoice): ListingSignal | null => {
    try {
      const cleaned = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      const confidence = Number(parsed.confidence ?? 0);
      if (!Number.isFinite(confidence)) return null;
      return {
        confidence,
        thesis: parsed.thesis || "No specific knowledge of this project.",
        stopLossPct: Number(parsed.stopLossPct ?? 20),
        takeProfitPct: Number(parsed.takeProfitPct ?? 20),
        source
      };
    } catch (error) {
      console.warn("Listing AI parse failed", error);
      return null;
    }
  };

  try {
    const ds = await callDeepSeek(prompt, opts?.deepseekKey);
    if (ds) {
      const result = parseOne(ds, "deepseek");
      if (result) return result;
    }
  } catch (error) {
    console.error("DeepSeek error (listing signal), falling back to OpenAI", error);
  }

  try {
    const openai = await callOpenAI(prompt, opts?.openaiKey);
    if (openai) {
      const result = parseOne(openai, "openai");
      if (result) return result;
    }
  } catch (error) {
    console.error("OpenAI error (listing signal)", error);
  }

  return null;
}
