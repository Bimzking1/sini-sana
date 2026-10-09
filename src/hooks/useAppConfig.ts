import { useMemo } from "react";
import { loadAppConfig, type AppConfig } from "../lib/config";

export function useAppConfig(): AppConfig {
  return useMemo(() => loadAppConfig(), []);
}