import process from "node:process";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";

let sdk;

export async function initTracing({ serviceName, jaegerEndpoint }) {
  if (!jaegerEndpoint) {
    return;
  }
  sdk = new NodeSDK({
    serviceName,
    traceExporter: new JaegerExporter({ endpoint: jaegerEndpoint }),
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
