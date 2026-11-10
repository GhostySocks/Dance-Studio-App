import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

export const styles = {
  text: { fontSize: "15px", lineHeight: "24px", color: "#374151", margin: "0 0 12px" },
  muted: { fontSize: "13px", lineHeight: "20px", color: "#6b7280", margin: "0 0 8px" },
  label: { fontSize: "13px", color: "#6b7280", padding: "6px 0" },
  value: { fontSize: "14px", color: "#111827", padding: "6px 0", textAlign: "right" },
  total: { fontSize: "16px", fontWeight: 700, color: "#111827", padding: "10px 0" },
  button: {
    backgroundColor: "#1c8247",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "12px 20px",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
  },
} satisfies Record<string, CSSProperties>;

const body: CSSProperties = {
  backgroundColor: "#f4f5f7",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 0",
};

const container: CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px",
};

export function EmailLayout({
  studioName,
  preview,
  heading,
  children,
}: {
  studioName: string;
  preview: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={{ ...styles.muted, fontWeight: 600, letterSpacing: "0.04em" }}>
            {studioName.toUpperCase()}
          </Text>
          <Heading as="h1" style={{ fontSize: "22px", color: "#111827", margin: "0 0 16px" }}>
            {heading}
          </Heading>
          <Section>{children}</Section>
          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 16px" }} />
          <Text style={styles.muted}>
            This is an automated message from {studioName}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
