import { Text } from "@react-email/components";
import { EmailLayout, styles } from "./components/layout";

export interface AdminNoticeEmailProps {
  studioName: string;
  heading: string;
  message: string;
}

export default function AdminNoticeEmail({ studioName, heading, message }: AdminNoticeEmailProps) {
  return (
    <EmailLayout studioName={studioName} preview={heading} heading={heading}>
      <Text style={styles.text}>{message}</Text>
    </EmailLayout>
  );
}
