import { logs } from "@opentelemetry/api-logs";
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";

// Troca o envio de logs para o Grafana por uma lista em memoria, para o teste
// conferir o que teria sido mandado (ver back/log-de-erro.ts). Chamar
// `parar()` no fim, para nenhum outro teste herdar a lista.
export function capturarLogs() {
  const exportador = new InMemoryLogRecordExporter();
  logs.disable();
  logs.setGlobalLoggerProvider(new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter: exportador })] }));
  return {
    corpos: () => exportador.getFinishedLogRecords().map((registro) => String(registro.body)),
    parar: () => logs.disable(),
  };
}
