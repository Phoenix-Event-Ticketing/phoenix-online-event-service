import process from "node:process";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

let sdk;

export async function initTracing({ serviceName, jaegerEndpoint }) {
  if (!jaegerEndpoint) {
    return;
  }
  sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url: jaegerEndpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  await sdk.start();
}

export async function shutdownTracing() {
  if (sdk) {
    await sdk.shutdown();
    sdk = undefined;
  }
}

process.on("SIGTERM", () => {
  shutdownTracing().catch(() => {});
});
