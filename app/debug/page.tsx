import type { Metadata } from "next";
import { DebugLogViewer } from "@/components/debug-log-viewer";

export const metadata: Metadata = {
  title: "\u9879\u76ee\u67b6\u6784\u4e0e\u6267\u884c\u63a7\u5236\u53f0",
  description: "\u67e5\u770b\u9879\u76ee\u67b6\u6784\u3001\u4e00\u81f4\u6027\u56fe\u3001\u8fd4\u4fee\u89c4\u5212\u4e0e HTML5 \u4ea4\u4ed8\u8f93\u51fa\u3002",
};

export default function DebugPage() {
  return <DebugLogViewer />;
}
