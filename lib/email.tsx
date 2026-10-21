import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
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

// Shared visual language across both email templates -- previously each
// template inlined its own ad hoc colors/spacing, which is how a plain list
// of <Row>s with no card structure, badges, or footer ended up looking
// unfinished rather than like a real product email.
const palette = {
  bg: "#0a0e17",
  card: "#11172a",
  cardBorder: "#1f2a44",
  divider: "#1c2438",
  heading: "#f1f5f9",
  body: "#cbd5e1",
  muted: "#7c8aa8",
  brand: "#22d3ee",
  positive: "#34d399",
  negative: "#f87171"
};

function confidenceColor(confidence: number) {
  if (confidence >= 88) return palette.positive;
  if (confidence >= 80) return palette.brand;
  return palette.muted;
}

function EmailShell({ preview, children }: { preview: string; children: React.ReactNode }) {
  const settingsUrl = process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/settings` : null;
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ fontFamily: "-apple-system, Segoe UI, Inter, Arial, sans-serif", background: palette.bg, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto" }}>
          <Section style={{ padding: "0 8px 20px" }}>
            <Text style={{ color: palette.brand, fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", margin: 0, textTransform: "uppercase" }}>
              ApexPulse
            </Text>
          </Section>
          <Section style={{ background: palette.card, border: `1px solid ${palette.cardBorder}`, borderRadius: "16px", padding: "28px" }}>
            {children}
          </Section>
          <Section style={{ padding: "20px 8px 0" }}>
            <Hr style={{ borderColor: palette.divider, margin: "0 0 16px" }} />
            <Text style={{ color: palette.muted, fontSize: "12px", margin: "0 0 4px" }}>
              Self-hosted · AI-generated, not financial advice · Sent {new Date().toUTCString()}
            </Text>
            {settingsUrl && (
              <Text style={{ color: palette.muted, fontSize: "12px", margin: 0 }}>
                <Link href={settingsUrl} style={{ color: palette.muted, textDecoration: "underline" }}>
                  Manage alert preferences
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function StatBlock({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Column align="left">
      <Text style={{ color: palette.muted, fontSize: "11px", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </Text>
      <Text style={{ color: valueColor ?? palette.heading, fontSize: "14px", fontWeight: 600, margin: 0 }}>
        {value}
      </Text>
    </Column>
  );
}

export interface HoldingGroup {
  /** e.g. "Crypto (Binance)", "Trading 212", "Nigeria Stock (NGX)" */
  label: string;
  /** Display currency for this group only -- e.g. "NGN" for NGX. */
  displayCurrency: string;
  /** USD -> displayCurrency rate (1 for USD groups). */
  fxRate: number;
  rows: { asset: string; amount: number; valueUsd: number }[];
}

interface DailyProps {
  userName?: string;
  signals: SwingSignal[];
  holdingGroups: HoldingGroup[];
}

export function DailyEmail({ userName, signals, holdingGroups }: DailyProps) {
  const totalUsd = holdingGroups.reduce((t, g) => t + g.rows.reduce((s, r) => s + r.valueUsd, 0), 0);
  const nonEmptyGroups = holdingGroups.filter((g) => g.rows.length > 0);

  return (
    <EmailShell preview={`${signals.length} swing setup${signals.length === 1 ? "" : "s"} today, portfolio ${formatCurrency(totalUsd)}`}>
      <Heading style={{ color: palette.heading, fontSize: "20px", margin: "0 0 6px" }}>
        Good morning, {userName ?? "trader"}
      </Heading>
      <Text style={{ color: palette.body, fontSize: "14px", margin: "0 0 24px" }}>
        Your portfolio pulse and today&apos;s high-conviction swing setups.
      </Text>

      <Row style={{ marginBottom: "22px" }}>
        <Column>
          <Text style={{ color: palette.muted, fontSize: "11px", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Total portfolio value
          </Text>
          <Text style={{ color: palette.heading, fontSize: "20px", fontWeight: 700, margin: 0 }}>
            {formatCurrency(totalUsd)}
          </Text>
        </Column>
      </Row>

      {/* Separate table per market -- each shown in its own native currency
          (NGN for NGX, USD for Binance/Trading 212) instead of one flat list
          of every holding across every broker in USD. */}
      {nonEmptyGroups.map((group) => (
        <React.Fragment key={group.label}>
          <Text style={{ color: palette.muted, fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>
            {group.label}
          </Text>
          <Section style={{ border: `1px solid ${palette.cardBorder}`, borderRadius: "10px", padding: "4px 14px", marginBottom: "20px" }}>
            {group.rows.map((h, i) => (
              <Row
                key={h.asset}
                style={i < group.rows.length - 1 ? { borderBottom: `1px solid ${palette.divider}` } : undefined}
              >
                <Column style={{ padding: "10px 0" }}>
                  <Text style={{ color: palette.heading, fontSize: "14px", fontWeight: 600, margin: 0 }}>{h.asset}</Text>
                </Column>
                <Column align="right" style={{ padding: "10px 0" }}>
                  <Text style={{ color: palette.muted, fontSize: "13px", margin: 0 }}>{h.amount.toFixed(4)}</Text>
                </Column>
                <Column align="right" style={{ padding: "10px 0" }}>
                  <Text style={{ color: palette.heading, fontSize: "14px", fontWeight: 600, margin: 0 }}>
                    {formatCurrency(h.valueUsd * group.fxRate, group.displayCurrency)}
                  </Text>
                </Column>
              </Row>
            ))}
            <Row>
              <Column style={{ padding: "10px 0", borderTop: `1px solid ${palette.cardBorder}` }}>
                <Text style={{ color: palette.muted, fontSize: "12px", fontWeight: 700, margin: 0, textTransform: "uppercase" }}>Subtotal</Text>
              </Column>
              <Column />
              <Column align="right" style={{ padding: "10px 0", borderTop: `1px solid ${palette.cardBorder}` }}>
                <Text style={{ color: palette.brand, fontSize: "15px", fontWeight: 700, margin: 0 }}>
                  {formatCurrency(group.rows.reduce((s, r) => s + r.valueUsd, 0) * group.fxRate, group.displayCurrency)}
                </Text>
              </Column>
            </Row>
          </Section>
        </React.Fragment>
      ))}

      <Text style={{ color: palette.muted, fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>
        Swing Signals · Binance · 24-72h
      </Text>
      {signals.length === 0 ? (
        <Section style={{ border: `1px dashed ${palette.cardBorder}`, borderRadius: "10px", padding: "18px" }}>
          <Text style={{ color: palette.body, fontSize: "13px", margin: 0 }}>
            No setup cleared our confidence bar today. That&apos;s intentional -- we&apos;d rather send nothing
            than a weak pick.
          </Text>
        </Section>
      ) : (
        signals.map((s, i) => (
          <Section
            key={s.symbol}
            style={{
              border: `1px solid ${palette.cardBorder}`,
              borderRadius: "10px",
              padding: "16px",
              marginBottom: i < signals.length - 1 ? "12px" : 0
            }}
          >
            <Row>
              <Column>
                <Text style={{ color: palette.heading, fontSize: "16px", fontWeight: 700, margin: 0 }}>
                  {s.symbol}
                  {s.pool && (
                    <span style={{ color: palette.muted, fontSize: "11px", fontWeight: 600, marginLeft: "8px", textTransform: "uppercase" }}>
                      {s.pool.replace("_", " ")}
                    </span>
                  )}
                </Text>
              </Column>
              <Column align="right">
                <Text
                  style={{
                    display: "inline-block",
                    color: confidenceColor(s.confidence),
                    fontSize: "12px",
                    fontWeight: 700,
                    margin: 0
                  }}
                >
                  {s.confidence}% confidence
                </Text>
              </Column>
            </Row>
            <Text style={{ color: palette.body, fontSize: "13px", margin: "8px 0 14px", lineHeight: "1.5" }}>
              {s.thesis}
            </Text>
            <Row>
              <StatBlock label="Entry" value={s.entryPrice ? formatCurrency(s.entryPrice) : "n/a"} />
              <StatBlock
                label="Stop Loss"
                value={
                  s.stopLoss !== undefined
                    ? `${s.stopLoss}%${s.entryPrice ? ` (${formatCurrency(s.entryPrice * (1 + s.stopLoss / 100))})` : ""}`
                    : "n/a"
                }
                valueColor={palette.negative}
              />
              <StatBlock
                label="Take Profit"
                value={
                  s.takeProfit !== undefined
                    ? `${s.takeProfit}%${s.entryPrice ? ` (${formatCurrency(s.entryPrice * (1 + s.takeProfit / 100))})` : ""}`
                    : "n/a"
                }
                valueColor={palette.positive}
              />
            </Row>
            <Text style={{ color: palette.muted, fontSize: "11px", margin: "12px 0 0" }}>
              Model: {s.source.toUpperCase()}
            </Text>
          </Section>
        ))
      )}
    </EmailShell>
  );
}

export async function sendDailyEmail(props: {
  to: string;
  userName?: string;
  signals: SwingSignal[];
  holdingGroups: HoldingGroup[];
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
    <EmailShell preview={`New Binance listing: ${listing.pair} -- trading opens soon`}>
      <Row>
        <Column>
          <Text style={{ color: palette.brand, fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 6px" }}>
            New listing detected
          </Text>
          <Heading style={{ color: palette.heading, fontSize: "22px", margin: "0 0 4px" }}>
            {listing.pair}
          </Heading>
        </Column>
      </Row>
      <Text style={{ color: palette.body, fontSize: "14px", margin: "0 0 6px" }}>
        Hi {userName ?? "trader"}, Binance just announced this. Trading opens{" "}
        <strong style={{ color: palette.heading }}>
          {listing.goLiveAt ? listing.goLiveAt.toUTCString() : "soon"}
        </strong>
        .
      </Text>
      <Text style={{ margin: "0 0 24px" }}>
        <Link href={listing.url} style={{ color: palette.muted, fontSize: "12px", textDecoration: "underline" }}>
          {listing.title}
        </Link>
      </Text>

      <Text style={{ color: palette.muted, fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 10px" }}>
        AI Read
      </Text>
      <Section style={{ border: `1px solid ${palette.cardBorder}`, borderRadius: "10px", padding: "16px" }}>
        {meetsBar && signal ? (
          <>
            <Row>
              <Column>
                <Text
                  style={{ display: "inline-block", color: confidenceColor(signal.confidence), fontSize: "12px", fontWeight: 700, margin: 0 }}
                >
                  {signal.confidence}% confidence
                </Text>
              </Column>
            </Row>
            <Text style={{ color: palette.body, fontSize: "13px", margin: "8px 0 14px", lineHeight: "1.5" }}>
              {signal.thesis}
            </Text>
            <Row>
              <StatBlock label="Suggested Size" value={suggestedBuyUsd ? formatCurrency(suggestedBuyUsd) : "n/a"} />
              <StatBlock label="Stop Loss" value={`${signal.stopLossPct}%`} valueColor={palette.negative} />
              <StatBlock label="Take Profit" value={`${signal.takeProfitPct}%`} valueColor={palette.positive} />
            </Row>
            <Text style={{ color: palette.muted, fontSize: "11px", margin: "12px 0 0" }}>
              Model: {signal.source.toUpperCase()}
            </Text>
          </>
        ) : (
          <Text style={{ color: palette.body, fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
            {signal
              ? `AI confidence (${signal.confidence}%) didn't clear our bar for a recommendation -- ${signal.thesis}`
              : "AI analysis wasn't available for this listing."}{" "}
            No suggested position -- this is announcement-only. There is no price history for a
            brand-new listing, and new listings are extremely volatile in their first hours. Trade
            at your own risk if you choose to.
          </Text>
        )}
      </Section>
      <Text style={{ color: palette.muted, fontSize: "12px", margin: "20px 0 0" }}>
        Event-triggered alert, separate from your daily digest.
      </Text>
    </EmailShell>
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
