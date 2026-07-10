export interface PublisherData {
  publisherId: string;
  publisherName: string;
  dataCenter: string; // Region
  pod: string;
  pubType: string;
  capacityQps: number;
  capacityAbsolute: number; // Allocation AdRequests
  capacityBeforeAdjustments: number;
  adRequestAdjustments: number;
  totalTraffic: number;
  avgDailyTraffic: number;
  utilization: number;
  csm: string;
  csom: string;
  integrationType: string;
  amMember: boolean;
  dailyTraffic: Record<string, number>;
  dcAllocation: Record<string, number>;
  dcDistribution: Record<string, number>;
}

export interface ComparisonData {
  current: PublisherData[];
  previous?: PublisherData[];
}

export interface QoQMetrics {
  capacityChangeAbs: number;
  capacityChangePct: number;
  trafficChangeAbs: number;
  trafficChangePct: number;
  utilizationChange: number;
  newPublishers: string[];
  droppedPublishers: string[];
}

export interface DashboardState {
  currentData: PublisherData[];
  previousData: PublisherData[];
  filteredData: PublisherData[];
  metrics: QoQMetrics | null;
  supplyTrendData: SupplyTrendEntry[];
  loading: boolean;
  error: string | null;
}

// ─── Supply Trend ─────────────────────────────────────────────────────────────

export interface SupplyTrendEntry {
  publisherId: string;
  dailyRequests: Record<string, number>; // dateKey → total requests
  dailyGeCPM: Record<string, number>;    // dateKey → geCPM value
  avgRequests: number;  // avg of last 7 available days
  avgGeCPM: number;     // avg of last 7 available days
  dates: string[];      // sorted date keys present in dailyRequests
}

export type CapacityStatus = 'over' | 'inline' | 'under' | 'no-data';

export interface PublisherSupplyAnalysis {
  publisherId: string;
  publisherName: string;
  dataCenter: string;
  pod: string;
  csm: string;
  csom: string;
  integrationType: string;
  amMember: boolean;
  capacityAbsolute: number;
  avgDailySupply: number;
  avgGeCPM: number;
  supplyPct: number; // (avgDailySupply / capacityAbsolute) * 100
  status: CapacityStatus;
  dailyRequests: Record<string, number>;
  dailyGeCPM: Record<string, number>;
  dates: string[];
}
