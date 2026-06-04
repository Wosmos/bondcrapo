import { redirect } from "next/navigation";
import { todayInPakistan } from "@/features/bonds/format";

/** /prize-bonds/schedule goes to the current year. */
export default async function ScheduleIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/prize-bonds/schedule/${todayInPakistan().slice(0, 4)}`);
}
