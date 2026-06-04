import * as XLSX from 'xlsx';
import { PublisherData, QoQMetrics, SupplyTrendEntry, PublisherSupplyAnalysis, CapacityStatus } from '../types';

// ─── Shared numeric parser ────────────────────────────────────────────────────

export const parseNumeric = (val: any): number => {
  // Fast path: already a JS number (raw:true XLSX cells)
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val && val !== 0) return 0;
  // Strip common currency symbols, commas, spaces, percent signs
  const str = String(val).replace(/[$,\s%]/g, '').toLowerCase().trim();
  if (str === '' || str === '-' || str === 'n/a') return 0;
  let multiplier = 1;
  if (str.endsWith('k')) multiplier = 1_000;
  if (str.endsWith('m')) multiplier = 1_000_000;
  if (str.endsWith('b')) multiplier = 1_000_000_000;
  const num = parseFloat(str.replace(/[kmb]$/, ''));
  return isNaN(num) ? 0 : num * multiplier;
};

// ─── Capacity file parser ─────────────────────────────────────────────────────

export const parseExcel = async (file: File): Promise<PublisherData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 1) throw new Error('File is empty');

        let headerRowIdx = 0;
        let maxMatches = 0;
        const targetHeaders = ['Ω', 'publisher', 'allocation', 'qps', 'csm', 'csom', 'integrations', 'region'];

        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i];
          if (!row) continue;
          let matches = 0;
          row.forEach((cell: any) => {
            const s = String(cell || '').toLowerCase();
            if (targetHeaders.some(th => s === th || s.includes(th))) matches++;
          });
          const hasStrongIndicator = row.some((cell: any) => {
            const s = String(cell || '').toLowerCase();
            return s === 'ω' || s === 'publisher';
          });
          if (hasStrongIndicator) matches += 10;
          if (matches > maxMatches) { maxMatches = matches; headerRowIdx = i; }
        }

        const headers = (jsonData[headerRowIdx] || []).map((h: any) => String(h || '').trim());
        const rows = jsonData.slice(headerRowIdx + 1);

        if (maxMatches < 2) throw new Error('Could not identify header row. Please ensure your file has columns like "Publisher" or "Allocation".');

        const findIndex = (names: string[]) =>
          headers.findIndex((h: string) => h && names.some(n => h.toLowerCase() === n.toLowerCase() || h.toLowerCase().includes(n.toLowerCase())));

        const pubIdIdx    = findIndex(['Ω', 'publisher id', 'pub id', 'id']);
        const pubNameIdx  = findIndex(['publisher', 'publisher name', 'name']);
        const regionIdx   = findIndex(['region']);
        const podIdx      = findIndex(['pod']);
        const pubTypeIdx  = findIndex(['pub type']);
        const capQpsIdx   = findIndex(['allocation - qps', 'capacity qps', 'qps']);
        const capAbsIdx   = findIndex(['allocation - adrequests', 'capacity absolute']);
        const adjIdx      = findIndex(['adrequest adjustments', 'adjustments']);
        const capBeforeIdx = findIndex(['allocation - adrequests (before adjustments)', 'before adjustments']);
        const csmIdx      = findIndex(['csm']);
        const csomIdx     = findIndex(['csom']);
        const integrationIdx = headers[11]?.toLowerCase().includes('integration') ? 11 : findIndex(['integrations', 'integration type']);
        const amMemberIdx    = headers[12]?.toLowerCase().includes('am member') ? 12 : findIndex(['am member']);

        const dcNames = ['east', 'west', 'emea', 'apac', 'jpac'];
        const dcAllocCols: Record<string, number> = {};
        const dcDistCols: Record<string, number> = {};

        dcNames.forEach((name, idx) => {
          const targetIdx = 16 + idx;
          if (headers[targetIdx]?.toLowerCase().includes(name)) {
            dcAllocCols[name] = targetIdx;
          } else {
            const foundIdx = headers.findIndex((h: string, i: number) => i >= 15 && h.toLowerCase() === name);
            if (foundIdx !== -1) dcAllocCols[name] = foundIdx;
          }
        });

        dcNames.forEach(name => {
          const foundIndices = headers.map((h: string, i: number) => h.toLowerCase() === name ? i : -1).filter((i: number) => i !== -1);
          if (foundIndices.length >= 3) dcDistCols[name] = foundIndices[2];
        });

        const parsedData: PublisherData[] = rows.map((row: any) => {
          if (!row) return null;
          const id   = pubIdIdx   !== -1 ? String(row[pubIdIdx]   || '') : '';
          const name = pubNameIdx !== -1 ? String(row[pubNameIdx] || '') : '';
          if (!id && !name) return null;

          const adRequestAdjustments     = adjIdx      !== -1 ? parseNumeric(row[adjIdx])      : 0;
          const capacityBeforeAdjustments = capBeforeIdx !== -1 ? parseNumeric(row[capBeforeIdx]) : 0;
          const capacityAbsolute = capAbsIdx !== -1 ? parseNumeric(row[capAbsIdx]) : (capacityBeforeAdjustments + adRequestAdjustments);
          const capacityQps = capQpsIdx !== -1 ? parseNumeric(row[capQpsIdx]) : 0;
          const region = regionIdx !== -1 ? String(row[regionIdx] || 'Unknown') : 'Unknown';
          const pod    = podIdx    !== -1 ? String(row[podIdx]    || 'N/A')     : 'N/A';
          const pubType = pubTypeIdx !== -1 ? String(row[pubTypeIdx] || 'Publisher') : 'Publisher';
          const csm    = csmIdx    !== -1 ? String(row[csmIdx]    || 'N/A') : 'N/A';
          const csom   = csomIdx   !== -1 ? String(row[csomIdx]   || 'N/A') : 'N/A';
          const integration = integrationIdx !== -1 ? String(row[integrationIdx] || 'N/A') : 'N/A';
          const amMemberRaw = amMemberIdx !== -1 ? String(row[amMemberIdx] || '').trim().toLowerCase() : '';
          const amMember = amMemberRaw === 'yes';

          const dcAllocation: Record<string, number>  = {};
          const dcDistribution: Record<string, number> = {};
          let totalTraffic = 0;

          dcNames.forEach(dc => {
            const allocIdx = dcAllocCols[dc];
            const distIdx  = dcDistCols[dc];
            if (allocIdx !== undefined) {
              dcAllocation[dc] = parseNumeric(row[allocIdx]);
              totalTraffic += dcAllocation[dc];
            }
            if (distIdx !== undefined) {
              const distVal = String(row[distIdx] || '0');
              dcDistribution[dc] = parseFloat(distVal.replace('%', '')) || 0;
            }
          });

          return {
            publisherId: id,
            publisherName: name,
            dataCenter: region,
            pod,
            pubType,
            capacityQps,
            capacityAbsolute,
            capacityBeforeAdjustments,
            adRequestAdjustments,
            totalTraffic,
            avgDailyTraffic: totalTraffic / 30,
            utilization: capacityAbsolute > 0 ? (totalTraffic / capacityAbsolute) * 100 : 0,
            csm,
            csom,
            integrationType: integration,
            amMember,
            dailyTraffic: dcAllocation,
            dcAllocation,
            dcDistribution,
          };
        }).filter((d): d is PublisherData => d !== null && (d.publisherId !== '' || d.publisherName !== ''));

        if (parsedData.length === 0) throw new Error('No valid publisher data found in the file. Please check the column names and ensure there is data in the rows.');
        resolve(parsedData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

// ─── Supply Trend parser ──────────────────────────────────────────────────────

/** Attempt to extract a normalised YYYY-MM-DD key from any cell/header value. */
const extractDateKey = (raw: any): string | null => {
  if (raw === null || raw === undefined || raw === '') return null;

  // JavaScript Date object (xlsx cellDates:true)
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  // Excel date serial number — xlsx uses raw:true, so date cells backed by a number
  // come through as JS Date objects when cellDates:true is set. But as a safety net:
  if (typeof raw === 'number' && raw > 40_000 && raw < 60_000) {
    // Rough sanity check: Excel dates in the 2009-2064 range are 40000–60000
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }

  const s = String(raw).trim();

  // ISO: 2025-05-25  or  2025/05/25
  const iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  // US: 5/25/2025 or 5/25/25
  const us = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (us) {
    const yr = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${yr}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }

  // Short M/D without year (e.g. "5/25")
  const short = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (short) return `2025-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}`;

  return null;
};

/** True if the header looks like it belongs to a geCPM column. */
const isGeCPMHeader = (h: string): boolean => {
  const l = h.toLowerCase().replace(/[\s_\-]+/g, ''); // normalise: remove spaces/underscores/hyphens
  // Match any common geCPM / eCPM / CPM label variant
  if (l.includes('ecpm'))   return true;  // eCPM, geCPM, gecpm, e-cpm, avg_ecpm …
  if (l.includes('gecpm'))  return true;  // explicit gecpm
  if (l.includes('gecpm'))  return true;
  if (l.includes('grossecpm')) return true;
  if (l.includes('avgecpm'))   return true;
  if (l.includes('floorecpm')) return true;
  // generic "cpm" — but exclude column names that are about capacity/rate limits
  if (l.includes('cpm') && !l.includes('capacity') && !l.includes('qps') && !l.includes('limit')) return true;
  return false;
};

export const parseSupplyTrend = async (file: File): Promise<SupplyTrendEntry[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // cellDates:true → date-formatted cells come back as JS Date objects
        // raw:true        → numeric cells come back as actual JS numbers (not formatted strings)
        //                   this is essential so geCPM decimals like 2.45 stay as 2.45, not "2.45" or "$2.45"
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][];

        if (jsonData.length < 2) throw new Error('Supply trend file appears to be empty.');

        // Find first non-empty row as header
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          if (jsonData[i]?.some((c: any) => c !== null && c !== undefined && String(c).trim() !== '')) {
            headerRowIdx = i;
            break;
          }
        }

        const rawHeaders: any[] = jsonData[headerRowIdx] || [];
        const headers = rawHeaders.map(h => String(h ?? '').trim());
        const rows = jsonData.slice(headerRowIdx + 1).filter(r => r && r.some((c: any) => c !== null && c !== undefined && String(c).trim() !== ''));

        // ── Helpers ─────────────────────────────────────────────────────────
        const pubIdPatterns = ['publisher id', 'pub id', 'pubid', 'pub_id', 'publisher_id', 'publisherid'];

        const findPubIdIdx = (hdrs: string[]): number => {
          let idx = hdrs.findIndex(h => pubIdPatterns.includes(h.toLowerCase()));
          if (idx === -1) idx = hdrs.findIndex(h => {
            const l = h.toLowerCase();
            return (l.includes('pub') && (l.includes('id') || l === 'publisher')) || l === 'id';
          });
          return idx !== -1 ? idx : 0;
        };

        type ColMeta = { idx: number; dateKey: string };
        let requestCols: ColMeta[] = [];
        let geCpmCols:   ColMeta[] = [];
        let pubIdIdx = findPubIdIdx(headers);

        // ── Detect if this is a TWO-ROW header (section labels row + date row) ───
        //
        //   Format A (two-row):
        //     Row 0: ["",  "Supply Volume", "", ..., "geCPM", "", ...]
        //     Row 1: ["Publisher ID", "5/25", "5/26", ..., "5/25", "5/26", ...]
        //     Data:  [123456, 1000000, ...]
        //
        //   Detected when row 0 has a geCPM/Supply label but:
        //     - no Publisher ID found, OR
        //     - no date-like values anywhere in row 0
        //     AND the next row has a Publisher ID + date values
        // ─────────────────────────────────────────────────────────────────────────
        const row0HasGeCPMLabel   = headers.some(h => h && isGeCPMHeader(h));
        const row0HasAnyDate      = headers.some(h => !!extractDateKey(h));
        const row0HasPubId        = pubIdPatterns.includes(headers[pubIdIdx]?.toLowerCase() ?? '');

        let isTwoRowHeader = false;

        if (row0HasGeCPMLabel && !row0HasAnyDate && rows.length > 0) {
          // Row 0 has geCPM label but no dates → likely a section-label row
          // Check if row 1 (first data row) has Publisher ID + dates
          const row1Raw  = rows[0];
          const row1Strs = (row1Raw || []).map((c: any) => String(c ?? '').trim());
          const row1HasPubId  = row1Strs.some(h => pubIdPatterns.includes(h.toLowerCase()) || (h.toLowerCase().includes('pub') && h.toLowerCase().includes('id')));
          const row1DateCount = row1Strs.filter(h => !!extractDateKey(h)).length;

          if (row1HasPubId || row1DateCount >= 3) {
            isTwoRowHeader = true;
          }
        }

        if (isTwoRowHeader) {
          // Use row 0 section labels to determine which columns are Supply vs geCPM
          // Use row 1 as the actual header row for date extraction
          const sectionRow  = headers;                                        // row 0
          const row1Raw     = rows[0];
          const actualHdrs  = (row1Raw || []).map((c: any) => String(c ?? '').trim());

          pubIdIdx = findPubIdIdx(actualHdrs);

          // Find where the geCPM section starts in the section-label row
          const geCpmSectionCol = sectionRow.findIndex(h => h && isGeCPMHeader(h));

          actualHdrs.forEach((h: string, idx: number) => {
            if (idx === pubIdIdx) return;
            // Try date from the string header; also try the raw cell value (could be a Date object)
            const dk = extractDateKey(h) || extractDateKey(row1Raw[idx]);
            if (!dk) return;
            if (geCpmSectionCol !== -1 && idx >= geCpmSectionCol) {
              geCpmCols.push({ idx, dateKey: dk });
            } else {
              requestCols.push({ idx, dateKey: dk });
            }
          });

          // Skip the "actual header" row from data processing
          rows.splice(0, 1);

        } else {
          // ── Single-row header: explicit geCPM label detection (Format C) ───
          //
          //   Format C: ["Publisher ID", "5/25", ..., "geCPM 5/25", ...]
          // ─────────────────────────────────────────────────────────────────
          headers.forEach((h, idx) => {
            if (idx === pubIdIdx) return;
            if (!h) return; // empty header — handled by duplicate-date fallback below

            if (isGeCPMHeader(h)) {
              const stripped = h.replace(/gecpm|ge cpm|ecpm|cpm/gi, '').replace(/[_\-\s]+/g, ' ').trim();
              const dk = extractDateKey(stripped) || extractDateKey(h) || extractDateKey(rawHeaders[idx]) || `cpm_${idx}`;
              geCpmCols.push({ idx, dateKey: dk });
            } else {
              const dk = extractDateKey(h) || extractDateKey(rawHeaders[idx]);
              if (dk) requestCols.push({ idx, dateKey: dk });
            }
          });

          // ── Fallback A: duplicate date keys → second set is geCPM (Format B) ──
          //
          //   Format B: ["Publisher ID", "5/25", "5/26", ..., "5/25", "5/26", ...]
          //             (same dates appear twice — first half supply, second half geCPM)
          // ─────────────────────────────────────────────────────────────────────────
          if (geCpmCols.length === 0) {
            const seenKeys  = new Set<string>();
            const firstSet:  ColMeta[] = [];
            const secondSet: ColMeta[] = [];
            requestCols.forEach(col => {
              if (seenKeys.has(col.dateKey)) {
                secondSet.push(col);
              } else {
                seenKeys.add(col.dateKey);
                firstSet.push(col);
              }
            });
            if (secondSet.length > 0) {
              requestCols = firstSet;
              geCpmCols   = secondSet;
            }
          }

          // ── Fallback B: no date cols at all → treat all non-ID columns as supply days
          if (requestCols.length === 0) {
            headers.forEach((h, idx) => {
              if (idx === pubIdIdx || isGeCPMHeader(h)) return;
              requestCols.push({ idx, dateKey: h || `day_${idx}` });
            });
          }
        }

        console.log('[SupplyTrend] isTwoRowHeader:', isTwoRowHeader, '| pubIdIdx:', pubIdIdx);
        console.log('[SupplyTrend] requestCols:', requestCols);
        console.log('[SupplyTrend] geCpmCols:', geCpmCols);
        console.log('[SupplyTrend] first data row sample:', rows[0]?.slice(0, 5));

        // ── Parse rows ──────────────────────────────────────────────────────
        const entryMap = new Map<string, SupplyTrendEntry>();

        rows.forEach((row: any[]) => {
          if (!row) return;
          const rawId = row[pubIdIdx];
          if (rawId === null || rawId === undefined || String(rawId).trim() === '') return;
          const publisherId = String(rawId).trim();

          let entry = entryMap.get(publisherId);
          if (!entry) {
            entry = { publisherId, dailyRequests: {}, dailyGeCPM: {}, avgRequests: 0, avgGeCPM: 0, dates: [] };
            entryMap.set(publisherId, entry);
          }

          requestCols.forEach(({ idx, dateKey }) => {
            const val = parseNumeric(row[idx]);
            if (val > 0) entry!.dailyRequests[dateKey] = (entry!.dailyRequests[dateKey] || 0) + val;
          });

          geCpmCols.forEach(({ idx, dateKey }) => {
            const val = parseNumeric(row[idx]);
            if (val > 0) entry!.dailyGeCPM[dateKey] = val; // latest wins for duplicates
          });
        });

        // ── Compute averages over last 7 available days ──────────────────────
        const entries: SupplyTrendEntry[] = [];
        entryMap.forEach(entry => {
          const sortedDates = Object.keys(entry.dailyRequests).sort();
          const last7 = sortedDates.slice(-7);
          entry.dates = sortedDates;
          entry.avgRequests = last7.length > 0
            ? last7.reduce((sum, d) => sum + (entry.dailyRequests[d] || 0), 0) / last7.length
            : 0;

          const gDates = Object.keys(entry.dailyGeCPM).sort().slice(-7);
          entry.avgGeCPM = gDates.length > 0
            ? gDates.reduce((sum, d) => sum + (entry.dailyGeCPM[d] || 0), 0) / gDates.length
            : 0;

          if (entry.avgRequests > 0 || entry.avgGeCPM > 0) entries.push(entry);
        });

        if (entries.length === 0) throw new Error('No supply data could be extracted. Please check the file format — expected columns: Publisher ID, date columns for requests, and optional geCPM columns.');
        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// ─── Supply analysis engine ───────────────────────────────────────────────────

const OVER_THRESHOLD   = 100; // supply > 100% of capacity
const INLINE_THRESHOLD =  70; // supply between 70-100%
// below 70% → under

export const buildSupplyAnalysis = (
  currentData: PublisherData[],
  supplyTrend: SupplyTrendEntry[]
): PublisherSupplyAnalysis[] => {
  const trendMap = new Map(supplyTrend.map(t => [t.publisherId, t]));

  return currentData.map(pub => {
    const trend = trendMap.get(pub.publisherId);
    const avgDailySupply = trend?.avgRequests ?? 0;
    const avgGeCPM       = trend?.avgGeCPM    ?? 0;
    const supplyPct      = pub.capacityAbsolute > 0 ? (avgDailySupply / pub.capacityAbsolute) * 100 : 0;

    let status: CapacityStatus = 'no-data';
    if (trend) {
      if (supplyPct > OVER_THRESHOLD)   status = 'over';
      else if (supplyPct >= INLINE_THRESHOLD) status = 'inline';
      else status = 'under';
    }

    return {
      publisherId:      pub.publisherId,
      publisherName:    pub.publisherName,
      dataCenter:       pub.dataCenter,
      csm:              pub.csm,
      csom:             pub.csom,
      integrationType:  pub.integrationType,
      capacityAbsolute: pub.capacityAbsolute,
      avgDailySupply,
      avgGeCPM,
      supplyPct,
      status,
      dailyRequests: trend?.dailyRequests ?? {},
      dailyGeCPM:    trend?.dailyGeCPM    ?? {},
      dates:         trend?.dates         ?? [],
    };
  });
};

// ─── QoQ Metrics ─────────────────────────────────────────────────────────────

export const calculateQoQ = (current: PublisherData[], previous: PublisherData[]): QoQMetrics => {
  const currentTotalCap  = current.reduce((acc, d) => acc + d.capacityAbsolute, 0);
  const previousTotalCap = previous.reduce((acc, d) => acc + d.capacityAbsolute, 0);
  const currentTotalTraffic  = current.reduce((acc, d) => acc + d.totalTraffic, 0);
  const previousTotalTraffic = previous.reduce((acc, d) => acc + d.totalTraffic, 0);
  const currentAvgUtil  = currentTotalCap  > 0 ? (currentTotalTraffic  / currentTotalCap)  * 100 : 0;
  const previousAvgUtil = previousTotalCap > 0 ? (previousTotalTraffic / previousTotalCap) * 100 : 0;

  const currentIds  = new Set(current.map(d => d.publisherId));
  const previousIds = new Set(previous.map(d => d.publisherId));

  return {
    capacityChangeAbs:  currentTotalCap  - previousTotalCap,
    capacityChangePct:  previousTotalCap  > 0 ? ((currentTotalCap  - previousTotalCap)  / previousTotalCap)  * 100 : 0,
    trafficChangeAbs:   currentTotalTraffic  - previousTotalTraffic,
    trafficChangePct:   previousTotalTraffic > 0 ? ((currentTotalTraffic  - previousTotalTraffic) / previousTotalTraffic) * 100 : 0,
    utilizationChange:  currentAvgUtil - previousAvgUtil,
    newPublishers:      Array.from(currentIds).filter(id => !previousIds.has(id)),
    droppedPublishers:  Array.from(previousIds).filter(id => !currentIds.has(id)),
  };
};

// ─── Formatters ──────────────────────────────────────────────────────────────

export const formatNumber = (num: number): string => {
  const sign = num < 0 ? '-' : '';
  const abs  = Math.abs(num);
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1) + 'B';
  if (abs >= 1_000_000)     return sign + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000)         return sign + (abs / 1_000).toFixed(1) + 'K';
  return num.toFixed(0);
};

export const formatCurrency = (num: number): string => `$${num.toFixed(4)}`;

// ─── Template download ────────────────────────────────────────────────────────

export const downloadTemplate = () => {
  const headers1 = [
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'Allocation by Data Center', '', '', '', '',
    'PMR Ranking by Data Center', '', '', '', '',
    'Traffic Distribution by Data Center', '', '', '', '',
  ];
  const headers2 = [
    'Ω', 'PUBLISHER', 'ALLOCATION - AdRequests', 'ALLOCATION - QPS', 'Fair Share - AdRequests', 'Fair Share - QPS',
    'Pub Type', 'Region', 'POD', 'CSM', 'CSOM', 'Integrations', 'AM Member',
    'AdRequest Adjustments (AM Deals etc.)', 'Notes', 'ALLOCATION - AdRequests (Before adjustments)',
    'East', 'West', 'EMEA', 'APAC', 'JPAC',
    'East', 'West', 'EMEA', 'APAC', 'JPAC',
    'East', 'West', 'EMEA', 'APAC', 'JPAC',
  ];
  const sampleData = [
    ['158139', 'Example Publisher Inc.', '336.8M', '3.9K', '0.0K', '', 'Publisher', 'Americas', 'US Omni Direct', 'Hannah Macha', 'Vincent Yu', 'Prebid 1.0', 'No', '', '', '336.8M', '219.6M', '73.8M', '24.7M', '18.2M', '489.5K', '1', '1', '2', '15', '27', '65%', '22%', '7%', '5%', '0%'],
    ['164208', 'Digital Entertainment Co.', '643.8M', '7.5K', '0.0K', '', 'Publisher', 'APAC', 'SAsia', 'Harguneet Singh', 'Meghna Sharma', 'Tag, PubMatic OpenWrap', 'No', '', '', '643.8M', '0.0K', '0.0K', '0.0K', '643.8M', '0.0K', '0', '0', '0', '1', '0', '0%', '0%', '0%', '100%', '0%'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers1, headers2, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Capacity Data');
  XLSX.writeFile(wb, 'PubCap_Template.xlsx');
};
