import * as XLSX from 'xlsx';
import { PublisherData, QoQMetrics } from '../types';

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

        if (jsonData.length < 1) {
          throw new Error('File is empty');
        }

        // Find the header row by looking for the row with the most matches for expected columns
        let headerRowIdx = 0;
        let maxMatches = 0;
        const targetHeaders = ['Ω', 'publisher', 'allocation', 'qps', 'csm', 'csom', 'integrations', 'region'];
        
        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i];
          if (!row) continue;
          
          let matches = 0;
          row.forEach(cell => {
            const s = String(cell || '').toLowerCase();
            if (targetHeaders.some(th => s === th || s.includes(th))) {
              matches++;
            }
          });
          
          // "Ω" or "PUBLISHER" are very strong indicators
          const hasStrongIndicator = row.some(cell => {
            const s = String(cell || '').toLowerCase();
            return s === 'Ω' || s === 'publisher';
          });

          if (hasStrongIndicator) {
            matches += 10; // Weight strong indicators heavily
          }

          if (matches > maxMatches) {
            maxMatches = matches;
            headerRowIdx = i;
          }
        }

        const headers = (jsonData[headerRowIdx] || []).map(h => String(h || '').trim());
        const rows = jsonData.slice(headerRowIdx + 1);

        if (maxMatches < 2) {
          throw new Error('Could not identify header row. Please ensure your file has columns like "Publisher" or "Allocation".');
        }

        // Find key column indices with more specific matches for the provided screenshot
        const findIndex = (names: string[]) => 
          headers.findIndex(h => h && names.some(n => h.toLowerCase() === n.toLowerCase() || h.toLowerCase().includes(n.toLowerCase())));

        const pubIdIdx = findIndex(['Ω', 'publisher id', 'pub id', 'id']);
        const pubNameIdx = findIndex(['publisher', 'publisher name', 'name']);
        const regionIdx = findIndex(['region']);
        const podIdx = findIndex(['pod']);
        const pubTypeIdx = findIndex(['pub type']);
        const capQpsIdx = findIndex(['allocation - qps', 'capacity qps', 'qps']);
        const capAbsIdx = findIndex(['allocation - adrequests', 'capacity absolute']);
        const adjIdx = findIndex(['adrequest adjustments', 'adjustments']);
        const capBeforeIdx = findIndex(['allocation - adrequests (before adjustments)', 'before adjustments']);
        const csmIdx = findIndex(['csm']);
        const csomIdx = findIndex(['csom']);
        
        // User specified Column L (Index 11) for Integration and Column M (Index 12) for AM Member
        // We use these indices if they are within bounds and the header matches roughly, 
        // otherwise we fallback to findIndex.
        const integrationIdx = headers[11]?.toLowerCase().includes('integration') ? 11 : findIndex(['integrations', 'integration type']);
        const amMemberIdx = headers[12]?.toLowerCase().includes('am member') ? 12 : findIndex(['am member']);

        // Identify DC Allocation columns (User specified Column Q to U i.e. indices 16-20)
        const dcNames = ['east', 'west', 'emea', 'apac', 'jpac'];
        const dcAllocCols: Record<string, number> = {};
        const dcDistCols: Record<string, number> = {};
        
        // Map DC columns based on user's specific request (Q-U)
        dcNames.forEach((name, idx) => {
          const targetIdx = 16 + idx; // Q=16, R=17, S=18, T=19, U=20
          if (headers[targetIdx]?.toLowerCase().includes(name)) {
            dcAllocCols[name] = targetIdx;
          } else {
            // Fallback to searching if headers shifted
            const foundIdx = headers.findIndex((h, i) => i >= 15 && h.toLowerCase() === name);
            if (foundIdx !== -1) dcAllocCols[name] = foundIdx;
          }
        });

        // Map Distribution columns (usually the 3rd set of DC names in the template)
        dcNames.forEach(name => {
          const foundIndices = headers.map((h, i) => h.toLowerCase() === name ? i : -1).filter(i => i !== -1);
          if (foundIndices.length >= 3) {
            dcDistCols[name] = foundIndices[2];
          }
        });

        const parsedData: PublisherData[] = rows.map(row => {
          if (!row) return null;
          
          const id = pubIdIdx !== -1 ? String(row[pubIdIdx] || '') : '';
          const name = pubNameIdx !== -1 ? String(row[pubNameIdx] || '') : '';
          
          if (!id && !name) return null;

          const adRequestAdjustments = adjIdx !== -1 ? parseNumeric(row[adjIdx]) : 0;
          const capacityBeforeAdjustments = capBeforeIdx !== -1 ? parseNumeric(row[capBeforeIdx]) : 0;
          
          let capacityAbsolute = capAbsIdx !== -1 ? parseNumeric(row[capAbsIdx]) : (capacityBeforeAdjustments + adRequestAdjustments);
          
          const capacityQps = capQpsIdx !== -1 ? parseNumeric(row[capQpsIdx]) : 0;
          const region = regionIdx !== -1 ? String(row[regionIdx] || 'Unknown') : 'Unknown';
          const pod = podIdx !== -1 ? String(row[podIdx] || 'N/A') : 'N/A';
          const pubType = pubTypeIdx !== -1 ? String(row[pubTypeIdx] || 'Publisher') : 'Publisher';
          const csm = csmIdx !== -1 ? String(row[csmIdx] || 'N/A') : 'N/A';
          const csom = csomIdx !== -1 ? String(row[csomIdx] || 'N/A') : 'N/A';
          const integration = integrationIdx !== -1 ? String(row[integrationIdx] || 'N/A') : 'N/A';
          
          // AM Member check: Column M (Index 12). If input is "Yes", count it.
          const amMemberRaw = amMemberIdx !== -1 ? String(row[amMemberIdx] || '').trim().toLowerCase() : '';
          const amMember = amMemberRaw === 'yes';

          const dcAllocation: Record<string, number> = {};
          const dcDistribution: Record<string, number> = {};
          let totalTraffic = 0;
          
          dcNames.forEach(dc => {
            const allocIdx = dcAllocCols[dc];
            const distIdx = dcDistCols[dc];
            
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
            totalTraffic, // This will be the sum of DC allocations for now
            avgDailyTraffic: totalTraffic / 30, // Mocking daily avg
            utilization: capacityAbsolute > 0 ? (totalTraffic / capacityAbsolute) * 100 : 0,
            csm,
            csom,
            integrationType: integration,
            amMember,
            dailyTraffic: dcAllocation, // Using DC split as "daily" for charts
            dcAllocation,
            dcDistribution
          };
        }).filter((d): d is PublisherData => d !== null && (d.publisherId !== '' || d.publisherName !== ''));
        
        if (parsedData.length === 0) {
          throw new Error('No valid publisher data found in the file. Please check the column names and ensure there is data in the rows.');
        }

        resolve(parsedData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

const parseNumeric = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = String(val).replace(/[$,]/g, '').toLowerCase();
  let multiplier = 1;
  if (str.endsWith('k')) multiplier = 1000;
  if (str.endsWith('m')) multiplier = 1000000;
  if (str.endsWith('b')) multiplier = 1000000000;
  
  const num = parseFloat(str.replace(/[kmb]/g, ''));
  return isNaN(num) ? 0 : num * multiplier;
};

export const calculateQoQ = (current: PublisherData[], previous: PublisherData[]): QoQMetrics => {
  const currentTotalCap = current.reduce((acc, d) => acc + d.capacityAbsolute, 0);
  const previousTotalCap = previous.reduce((acc, d) => acc + d.capacityAbsolute, 0);
  
  const currentTotalTraffic = current.reduce((acc, d) => acc + d.totalTraffic, 0);
  const previousTotalTraffic = previous.reduce((acc, d) => acc + d.totalTraffic, 0);

  const currentAvgUtil = currentTotalCap > 0 ? (currentTotalTraffic / currentTotalCap) * 100 : 0;
  const previousAvgUtil = previousTotalCap > 0 ? (previousTotalTraffic / previousTotalCap) * 100 : 0;

  const currentIds = new Set(current.map(d => d.publisherId));
  const previousIds = new Set(previous.map(d => d.publisherId));

  const newPublishers = Array.from(currentIds).filter(id => !previousIds.has(id));
  const droppedPublishers = Array.from(previousIds).filter(id => !currentIds.has(id));

  return {
    capacityChangeAbs: currentTotalCap - previousTotalCap,
    capacityChangePct: previousTotalCap > 0 ? ((currentTotalCap - previousTotalCap) / previousTotalCap) * 100 : 0,
    trafficChangeAbs: currentTotalTraffic - previousTotalTraffic,
    trafficChangePct: previousTotalTraffic > 0 ? ((currentTotalTraffic - previousTotalTraffic) / previousTotalTraffic) * 100 : 0,
    utilizationChange: currentAvgUtil - previousAvgUtil,
    newPublishers,
    droppedPublishers
  };
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
};

export const downloadTemplate = () => {
  const headers1 = [
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 
    'Allocation by Data Center', '', '', '', '', 
    'PMR Ranking by Data Center', '', '', '', '', 
    'Traffic Distribution by Data Center', '', '', '', ''
  ];
  const headers2 = [
    'Ω', 'PUBLISHER', 'ALLOCATION - AdRequests', 'ALLOCATION - QPS', 'Fair Share - AdRequests', 'Fair Share - QPS', 
    'Pub Type', 'Region', 'POD', 'CSM', 'CSOM', 'Integrations', 'AM Member', 
    'AdRequest Adjustments (AM Deals etc.)', 'Notes', 'ALLOCATION - AdRequests (Before adjustments)',
    'East', 'West', 'EMEA', 'APAC', 'JPAC',
    'East', 'West', 'EMEA', 'APAC', 'JPAC',
    'East', 'West', 'EMEA', 'APAC', 'JPAC'
  ];
  
  const sampleData = [
    [
      '158139', 'Example Publisher Inc.', '336.8M', '3.9K', '0.0K', '', 
      'Publisher', 'Americas', 'US Omni Direct', 'Hannah Macha', 'Vincent Yu', 'Prebid 1.0', 'No', 
      '', '', '336.8M', 
      '219.6M', '73.8M', '24.7M', '18.2M', '489.5K',
      '1', '1', '2', '15', '27',
      '65%', '22%', '7%', '5%', '0%'
    ],
    [
      '164208', 'Digital Entertainment Co.', '643.8M', '7.5K', '0.0K', '', 
      'Publisher', 'APAC', 'SAsia', 'Harguneet Singh', 'Meghna Sharma', 'Tag, PubMatic OpenWrap', 'No', 
      '', '', '643.8M', 
      '0.0K', '0.0K', '0.0K', '643.8M', '0.0K',
      '0', '0', '0', '1', '0',
      '0%', '0%', '0%', '100%', '0%'
    ]
  ];

  const wsData = [headers1, headers2, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Basic styling/merging info (though aoa_to_sheet doesn't apply it to the file directly without more work, 
  // we can at least set the column widths or similar if needed)
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Capacity Data");
  
  XLSX.writeFile(wb, "PubCap_Template.xlsx");
};
