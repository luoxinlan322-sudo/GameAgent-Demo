import type { Metadata } from "next";
import { DebugLogViewer } from "@/components/debug-log-viewer";

export const metadata: Metadata = {
  title: "项目架构与执行控制台",
  description: "查看项目架构、一致性图、返修规划与 HTML5 交付输出。",
};

export default function DebugPage() {
  return <DebugLogViewer />;
}
