import { Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./components/layout";

export interface TeacherMessageEmailProps {
  studioName: string;
  teacherName: string;
  senderName: string;
  senderEmail: string;
  /** "Emma Thompson — Beginner Ballet" */
  links: string[];
  subject: string;
  message: string;
}

/** A message from a parent or student, sent to a teacher through the studio's site. */
export default function TeacherMessageEmail({
  studioName,
  teacherName,
  senderName,
  senderEmail,
  links,
  subject,
  message,
}: TeacherMessageEmailProps) {
  return (
    <EmailLayout studioName={studioName} preview={`${senderName}: ${subject}`} heading={subject}>
      <Text style={styles.text}>Hi {teacherName},</Text>
      <Text style={styles.text}>
        {senderName} sent you a message through the {studioName} website.
      </Text>
      <Section
        style={{
          borderLeft: "3px solid #05668D",
          padding: "4px 0 4px 16px",
          margin: "16px 0",
        }}
      >
        <Text style={{ ...styles.text, whiteSpace: "pre-wrap", margin: 0 }}>{message}</Text>
      </Section>
      <Text style={styles.muted}>In your classes: {links.join("; ")}</Text>
      <Text style={styles.muted}>
        Reply to this email to answer {senderName} directly ({senderEmail}).
      </Text>
    </EmailLayout>
  );
}
