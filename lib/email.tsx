import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Section,
  Text
} from "@react-email/components";
import { SwingSignal, ListingSignal, MIN_LISTING_CONFIDENCE } from "./ai";
import { formatCurrency } from "./utils";
import type { ListingAnnouncement } from "./binance-listings";

// Not cached as a singleton -- different users can have their own Resend
// key (ApiSetting.resendApiKey), so each send resolves its own client
// rather than locking in whichever key happened to be used first.
function getResend(apiKey?: string) {
  if (!apiKey) return null;
  return new Resend(apiKey);
}

interface DailyProps {
  userName?: string;
  signals: SwingSignal[];
  holdings: { asset: string; amount: number; value: number }[];
}

export function DailyEmail({ userName, signals, holdings }: DailyProps) {
  const value = holdings.reduce((t, h) => t + h.value, 0);

  return (
    <Html>
      <Head />
      <Preview>ApexPulse daily swings and portfolio health</Preview>
      <Body style={{ fontFamily: "Inter, Arial, sans-serif", background: "#0b1223", color: "#e2e8f0" }}>
        <Container style={{ padding: "32px", background: "#0f172a", borderRadius: "18px" }}>
          <Heading style={{ color: "#22d3ee", marginBottom: "12px" }}>
            ApexPulse Daily Signals
          </Heading>
          <Text style={{ color: "#cbd5e1", marginBottom: "24px" }}>
            Hi {userName ?? "trader"}, here is your swing plan and a quick pulse on the stack.
          </Text>
          <Section style={{ marginBottom: "24px" }}>
            <Heading as="h3" style={{ color: "#e2e8f0", fontSize: "18px" }}>
              Portfolio Snapshot — {formatCurrency(value)}
            </Heading>
            {holdings.map((h) => (
              <Row key={h.asset} style={{ color: "#cbd5e1", paddingBottom: "6px" }}>
                <Column>{h.asset}</Column>
                <Column align="right">{h.amount.toFixed(4)}</Column>
                <Column align="right">{formatCurrency(h.value)}</Column>
              </Row>
            ))}
          </Section>
          <Section>
            <Heading as="h3" style={{ color: "#e2e8f0", fontSize: "18px" }}>
              Swing Signals (24-72h)
            </Heading>
            {signals.map((s) => (
              <Row key={s.symbol} style={{ borderBottom: "1px solid #1f2937", padding: "8px 0" }}>
                <Column>
                  <Text style={{ color: "#22d3ee", fontWeight: 700 }}>{s.symbol}</Text>
                </Column>
                <Column>
                  <Text style={{ color: "#cbd5e1" }}>{s.thesis}</Text>
                  <Text style={{ color: "#94a3b8", fontSize: "12px" }}>
                    Confidence {s.confidence}% · SL {s.stopLoss ?? "n/a"}% · TP{" "}
                    {s.takeProfit ?? "n/a"}% · {s.source.toUpperCase()}
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>
          <Text style={{ color: "#94a3b8", marginTop: "24px" }}>
            Powered by OpenAI with DeepSeek fallback - remain in control, self-hosted.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function sendDailyEmail(props: {
  to: string;
  userName?: string;
  signals: SwingSignal[];
  holdings: { asset: string; amount: number; value: number }[];
  from?: string;
  apiKey?: string;
}) {
  const apiKey = props.apiKey || process.env.RESEND_API_KEY;
  const client = getResend(apiKey);
  const fromAddr = props.from || process.env.RESEND_FROM;
  if (!client) {
    return { skipped: true, reason: "no Resend API key configured (Settings or RESEND_API_KEY)" };
  }
  if (!fromAddr) {
    return { skipped: true, reason: "no Resend from-address configured (Settings or RESEND_FROM)" };
  }

  const html = render(<DailyEmail {...props} />);
  await client.emails.send({
    from: fromAddr,
    to: props.to,
    subject: "ApexPulse | AI Swing Signals",
    html
  });
  return { sent: true };
}

interface ListingAlertProps {
  userName?: string;
  listing: ListingAnnouncement;
  signal: ListingSignal | null;
  suggestedBuyUsd: number | null;
}

export function ListingAlertEmail({ userName, listing, signal, suggestedBuyUsd }: ListingAlertProps) {
  const meetsBar = signal && signal.confidence >= MIN_LISTING_CONFIDENCE;
  return (
    <Html>
      <Head />
      <Preview>New Binance listing: {listing.pair}</Preview>
      <Body style={{ fontFamily: "Inter, Arial, sans-serif", background: "#0b1223", color: "#e2e8f0" }}>
        <Container style={{ padding: "32px", background: "#0f172a", borderRadius: "18px" }}>
          <Heading style={{ color: "#22d3ee", marginBottom: "12px" }}>
            New Binance listing: {listing.pair}
          </Heading>
          <Text style={{ color: "#cbd5e1", marginBottom: "8px" }}>
            Hi {userName ?? "trader"}, Binance just announced this -- trading opens{" "}
            {listing.goLiveAt ? listing.goLiveAt.toUTCString() : "soon"}.
          </Text>
          <Text style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "24px" }}>
            <a href={listing.url} style={{ color: "#22d3ee" }}>{listing.title}</a>
          </Text>
          <Section style={{ marginBottom: "24px" }}>
            <Heading as="h3" style={{ color: "#e2e8f0", fontSize: "18px" }}>
              AI read
            </Heading>
            {meetsBar && signal ? (
              <>
                <Text style={{ color: "#cbd5e1" }}>{signal.thesis}</Text>
                <Text style={{ color: "#94a3b8", fontSize: "12px" }}>
                  Confidence {signal.confidence}% · SL {signal.stopLossPct}% · TP {signal.takeProfitPct}%
                  {suggestedBuyUsd ? ` · Suggested size ${formatCurrency(suggestedBuyUsd)}` : ""} ·{" "}
                  {signal.source.toUpperCase()}
                </Text>
              </>
            ) : (
              <Text style={{ color: "#94a3b8" }}>
                {signal
                  ? `AI confidence (${signal.confidence}%) didn't clear our bar for a recommendation -- ${signal.thesis}`
                  : "AI analysis wasn't available for this listing."}{" "}
                No suggested position; this is announcement-only. There is no price history for a
                brand-new listing, and new listings are extremely volatile in their first hours --
                trade at your own risk if you choose to.
              </Text>
            )}
          </Section>
          <Text style={{ color: "#94a3b8", marginTop: "24px" }}>
            Event-triggered alert, not part of your daily digest. Turn off in Settings if unwanted.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function sendListingAlertEmail(props: {
  to: string;
  userName?: string;
  listing: ListingAnnouncement;
  signal: ListingSignal | null;
  suggestedBuyUsd: number | null;
  from?: string;
  apiKey?: string;
}) {
  const apiKey = props.apiKey || process.env.RESEND_API_KEY;
  const client = getResend(apiKey);
  const fromAddr = props.from || process.env.RESEND_FROM;
  if (!client) {
    return { skipped: true, reason: "no Resend API key configured (Settings or RESEND_API_KEY)" };
  }
  if (!fromAddr) {
    return { skipped: true, reason: "no Resend from-address configured (Settings or RESEND_FROM)" };
  }

  const html = render(<ListingAlertEmail {...props} />);
  await client.emails.send({
    from: fromAddr,
    to: props.to,
    subject: `ApexPulse | New Listing: ${props.listing.pair}`,
    html
  });
  return { sent: true };
}
