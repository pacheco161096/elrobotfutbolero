import type { Metadata } from "next";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Redacción · El Robot Futbolero",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
