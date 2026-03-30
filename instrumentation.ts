import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

let sdkStarted = false;

export async function register() {
  if (sdkStarted) return;

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return;
  }

  const sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
        environment: process.env.LANGFUSE_ENV || process.env.NODE_ENV || "development",
        release: process.env.LANGFUSE_RELEASE || "game-agent-demo",
        exportMode: "immediate",
      }),
    ],
  });

  sdk.start();
  sdkStarted = true;
}
