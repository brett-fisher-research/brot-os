// Shared shape for the client-side Observability widget and its API route. Type-only imports here,
// so importing this module into a 'use client' component pulls no server code (health.ts uses
// child_process, cf-analytics.ts reads secret env) into the browser bundle.
import type { ServiceStatus } from './health';
import type { TrafficReport } from './cf-analytics';

export type PublicExperiment = { slug: string; host: string };

export type ObservabilityData = {
  health: ServiceStatus[];
  traffic: TrafficReport;
  publicExperiments: PublicExperiment[];
};
