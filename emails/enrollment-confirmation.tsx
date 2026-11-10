import { Text } from "@react-email/components";
import { EmailLayout, styles } from "./components/layout";

export interface EnrollmentConfirmationEmailProps {
  studioName: string;
  recipientName: string;
  studentName: string;
  className: string;
  teacherName: string;
  roomName: string;
  startsAt: string;
  waitlisted: boolean;
}

export default function EnrollmentConfirmationEmail({
  studioName,
  recipientName,
  studentName,
  className,
  teacherName,
  roomName,
  startsAt,
  waitlisted,
}: EnrollmentConfirmationEmailProps) {
  const heading = waitlisted ? "You're on the waitlist" : "Enrollment confirmed";
  return (
    <EmailLayout
      studioName={studioName}
      preview={`${studentName} — ${className}: ${heading.toLowerCase()}`}
      heading={heading}
    >
      <Text style={styles.text}>Hi {recipientName},</Text>
      <Text style={styles.text}>
        {waitlisted
          ? `${className} is currently full, so ${studentName} has been added to the waitlist. We'll enroll them automatically if a spot opens up.`
          : `${studentName} is enrolled in ${className}.`}
      </Text>
      <table width="100%" cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr>
            <td style={styles.label}>Class</td>
            <td style={styles.value}>{className}</td>
          </tr>
          <tr>
            <td style={styles.label}>When</td>
            <td style={styles.value}>{startsAt}</td>
          </tr>
          <tr>
            <td style={styles.label}>Teacher</td>
            <td style={styles.value}>{teacherName}</td>
          </tr>
          <tr>
            <td style={styles.label}>Room</td>
            <td style={styles.value}>{roomName}</td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
