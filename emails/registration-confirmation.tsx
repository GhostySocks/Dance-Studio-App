import { Text } from "@react-email/components";
import { EmailLayout, styles } from "./components/layout";

export interface RegistrationConfirmationEmailProps {
  studioName: string;
  recipientName: string;
  studentName: string;
  className: string;
  /** Term or season name. */
  covers: string;
  /** e.g. "Monthly — $85.00 per month" */
  billing: string;
  confirmedDates: number;
  waitlistedDates: number;
  firstDate: string | null;
}

export default function RegistrationConfirmationEmail({
  studioName,
  recipientName,
  studentName,
  className,
  covers,
  billing,
  confirmedDates,
  waitlistedDates,
  firstDate,
}: RegistrationConfirmationEmailProps) {
  const heading = confirmedDates > 0 ? "Registration confirmed" : "You're on the waitlist";
  return (
    <EmailLayout
      studioName={studioName}
      preview={`${studentName} — ${className} (${covers}): ${heading.toLowerCase()}`}
      heading={heading}
    >
      <Text style={styles.text}>Hi {recipientName},</Text>
      <Text style={styles.text}>
        {confirmedDates > 0
          ? `${studentName} is registered for ${className} for ${covers}.`
          : `${className} is currently full for ${covers}, so ${studentName} has been added to the waitlist.`}
      </Text>
      <table width="100%" cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr>
            <td style={styles.label}>Class</td>
            <td style={styles.value}>{className}</td>
          </tr>
          <tr>
            <td style={styles.label}>Covers</td>
            <td style={styles.value}>{covers}</td>
          </tr>
          <tr>
            <td style={styles.label}>Classes confirmed</td>
            <td style={styles.value}>{confirmedDates}</td>
          </tr>
          {firstDate && (
            <tr>
              <td style={styles.label}>First class</td>
              <td style={styles.value}>{firstDate}</td>
            </tr>
          )}
          <tr>
            <td style={styles.label}>Billing</td>
            <td style={styles.value}>{billing}</td>
          </tr>
        </tbody>
      </table>
      {waitlistedDates > 0 && confirmedDates > 0 && (
        <Text style={styles.muted}>
          {waitlistedDates} date{waitlistedDates === 1 ? " is" : "s are"} full. {studentName} is on
          the waitlist for {waitlistedDates === 1 ? "it" : "those"} and will be moved in automatically
          if a spot opens.
        </Text>
      )}
    </EmailLayout>
  );
}
