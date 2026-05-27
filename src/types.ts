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
  loading: boolean;
  error: string | null;
}
