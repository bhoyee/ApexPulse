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
import { SwingSignal } from "./ai";
import { formatCurrency } from "./utils";

let resendClient: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
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
}) {
  const client = getResend();
  const fromAddr = props.from || process.env.RESEND_FROM;
  if (!client || !fromAddr) {
    return { skipped: true };
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
