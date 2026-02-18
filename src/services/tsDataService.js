const TSDATA_API_URL = process.env.TSDATA_API_URL || 'https://tsdata.techassist.au';
const TSDATA_API_KEY = process.env.TSDATA_API_KEY || '';

async function fetchTsData(path, options = {}) {
  const url = new URL(path, TSDATA_API_URL);

  // Add query params
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers: {
      'X-API-Key': TSDATA_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TSDATA API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function fetchAllPages(path, params = {}) {
  const allResults = [];
  let page = 1;

  while (true) {
    const data = await fetchTsData(path, { params: { ...params, page } });

    if (Array.isArray(data)) {
      allResults.push(...data);
      break; // Non-paginated response
    }

    if (data.data) {
      allResults.push(...data.data);
    }

    // Check if there are more pages
    if (!data.meta || !data.meta.lastPage || page >= data.meta.lastPage) {
      break;
    }
    page++;
  }

  return allResults;
}

const tsDataService = {
  async getTimesheets({ workerId, fromDate, toDate, periodId } = {}) {
    return fetchAllPages('/api/data/timesheets', { workerId, fromDate, toDate, periodId });
  },

  async getWorkers({ status } = {}) {
    return fetchAllPages('/api/data/workers', { status });
  },

  async getCurrentPeriod() {
    return fetchTsData('/api/data/periods/current');
  },

  async triggerSync() {
    return fetchTsData('/api/system/scheduler/run-now', { method: 'POST' });
  },

  async getPeriods({ status, fromDate, toDate } = {}) {
    return fetchAllPages('/api/data/periods', { status, fromDate, toDate });
  },

  async getWorker(workerId) {
    return fetchTsData(`/api/data/workers/${workerId}`);
  },

  // Map TSDATA status strings to our local status enum
  mapStatus(tsDataStatus) {
    if (!tsDataStatus) return 'OPEN';
    const statusMap = {
      'open': 'OPEN',
      'draft': 'OPEN',
      'incomplete': 'INCOMPLETE',
      'submitted': 'SUBMITTED',
      'pending': 'SUBMITTED',
      'awaiting_approval': 'SUBMITTED',
      'approved': 'APPROVED',
      'locked': 'LOCKED',
      'processed': 'PROCESSED',
      'finalized': 'PROCESSED'
    };
    return statusMap[tsDataStatus.toLowerCase()] || 'OPEN';
  },

  // Check if a mapped status should be read-only (no edits allowed)
  isReadOnly(status) {
    return ['SUBMITTED', 'APPROVED', 'LOCKED', 'PROCESSED'].includes(status);
  }
};

module.exports = tsDataService;
