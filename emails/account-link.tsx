import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./components/layout";

export interface AccountLinkEmailProps {
  studioName: string;
  heading: string;
  message: string;
  buttonLabel: string;
  url: string;
  /** e.g. how long the link lasts and what to do if you did not ask for it. */
  footnote: string;
}

/** A single call-to-action email: reset your password, or confirm your email address. */
export default function AccountLinkEmail({
  studioName,
  heading,
  message,
  buttonLabel,
  url,
  footnote,
}: AccountLinkEmailProps) {
  return (
    <EmailLayout studioName={studioName} preview={heading} heading={heading}>
      <Text style={styles.text}>{message}</Text>
      <Section style={{ margin: "20px 0" }}>
        <Button href={url} style={styles.button}>
          {buttonLabel}
        </Button>
      </Section>
      <Text style={styles.muted}>{footnote}</Text>
      <Text style={styles.muted}>If the button does not work, copy this link: {url}</Text>
    </EmailLayout>
  );
}
