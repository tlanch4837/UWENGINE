const STORAGE_KEY = 'uwengine.outcomeLogs';

/**
 * @typedef {Object} OutcomeLog
 * @property {string | number} timestamp - When the log was created.
 * @property {string} [summary]
 * @property {string} [result]
 * @property {string} [outcome]
 * @property {string} [title]
 * @property {string} [message]
 * @property {string} [description]
 * @property {unknown} [details]
 */

/**
 * Global application state. Exposed on window for ease of debugging/tests.
 * @type {{ logs: OutcomeLog[] }}
 */
export const state = {
  logs: [],
};

if (typeof window !== 'undefined') {
  window.state = state;
}

const tableBody = document.getElementById('historyTableBody');
const statusMessage = document.getElementById('statusMessage');
const exportLogsButton = document.getElementById('exportLogsButton');
const importLogsInput = document.getElementById('importLogsInput');

/**
 * Loads persisted logs from localStorage.
 * @returns {OutcomeLog[]}
 */
function loadLogsFromStorage() {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    const validated = validateOutcomeLogArray(parsed);
    return validated ?? [];
  } catch (error) {
    console.error('Failed to parse logs from storage', error);
    return [];
  }
}

/**
 * Persists the current log collection to localStorage.
 */
function persistLogs() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.logs));
  } catch (error) {
    console.error('Unable to persist logs', error);
  }
}

/**
 * Updates the status message container.
 * @param {string} message
 * @param {'info' | 'error' | 'success'} [variant]
 */
function setStatus(message, variant = 'info') {
  if (!statusMessage) {
    return;
  }

  if (!message) {
    statusMessage.hidden = true;
    statusMessage.textContent = '';
    statusMessage.dataset.variant = 'info';
    return;
  }

  statusMessage.hidden = false;
  statusMessage.textContent = message;
  statusMessage.dataset.variant = variant;
}

/**
 * Formats a timestamp into a readable string.
 * @param {OutcomeLog['timestamp']} timestamp
 */
function formatTimestamp(timestamp) {
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString();
  }

  const numeric = Number(timestamp);
  if (!Number.isNaN(numeric)) {
    const asDate = new Date(numeric);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toLocaleString();
    }
  }

  const asDate = new Date(String(timestamp));
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.toLocaleString();
  }

  return String(timestamp);
}

/**
 * Chooses a human-friendly summary for a log entry.
 * @param {OutcomeLog} log
 */
function summariseLog(log) {
  const candidates = ['summary', 'result', 'outcome', 'message', 'title', 'description'];
  for (const key of candidates) {
    const value = log[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  const clean = { ...log };
  delete clean.timestamp;
  return Object.keys(clean).length ? JSON.stringify(clean) : '—';
}

/**
 * Re-renders the table that displays log history.
 */
export function refreshHistoryTable() {
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = '';

  if (!Array.isArray(state.logs) || state.logs.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 2;
    cell.textContent = 'No logs yet.';
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  for (const log of state.logs) {
    const row = document.createElement('tr');

    const timestampCell = document.createElement('td');
    timestampCell.textContent = formatTimestamp(log.timestamp);
    row.appendChild(timestampCell);

    const summaryCell = document.createElement('td');
    summaryCell.textContent = summariseLog(log);
    row.appendChild(summaryCell);

    tableBody.appendChild(row);
  }
}

/**
 * Validates a value as an OutcomeLog object.
 * @param {unknown} value
 * @returns {value is OutcomeLog}
 */
function isOutcomeLog(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  if (!('timestamp' in value)) {
    return false;
  }

  const { timestamp } = /** @type {{ timestamp: unknown }} */ (value);
  return (
    timestamp instanceof Date ||
    typeof timestamp === 'string' ||
    typeof timestamp === 'number'
  );
}

/**
 * Ensures an unknown value is an array of OutcomeLogs.
 * @param {unknown} value
 * @returns {OutcomeLog[] | null}
 */
function validateOutcomeLogArray(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const logs = [];
  for (const entry of value) {
    if (!isOutcomeLog(entry)) {
      return null;
    }
    logs.push({ ...entry });
  }

  return logs;
}

/**
 * Triggers an export of the current logs as a JSON file.
 */
function handleExportLogs() {
  try {
    const payload = JSON.stringify(state.logs, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'uw_logs.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setStatus('Logs exported successfully.', 'success');
  } catch (error) {
    console.error('Failed to export logs', error);
    setStatus('Unable to export logs. Check console for details.', 'error');
  }
}

/**
 * Reads an uploaded file and merges it into the application state.
 * @param {Event} event
 */
function handleImportLogs(event) {
  const input = /** @type {HTMLInputElement} */ (event.target);
  const file = input.files && input.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const result = reader.result;
      if (typeof result !== 'string') {
        throw new Error('Unexpected file content.');
      }

      const parsed = JSON.parse(result);
      const logs = validateOutcomeLogArray(parsed);
      if (!logs) {
        throw new Error('File is not a valid OutcomeLog collection.');
      }

      state.logs = logs;
      persistLogs();
      refreshHistoryTable();
      setStatus(`Imported ${logs.length} logs successfully.`, 'success');
    } catch (error) {
      console.error('Failed to import logs', error);
      setStatus('Unable to import logs. Ensure the file contains a valid log array.', 'error');
    } finally {
      input.value = '';
    }
  };

  reader.onerror = () => {
    console.error('Error reading log file', reader.error);
    setStatus('Unable to read the selected file.', 'error');
    input.value = '';
  };

  reader.readAsText(file);
}

function attachEventHandlers() {
  if (exportLogsButton) {
    exportLogsButton.addEventListener('click', handleExportLogs);
  }

  if (importLogsInput) {
    importLogsInput.addEventListener('change', handleImportLogs);
  }
}

function initialise() {
  state.logs = loadLogsFromStorage();

  if (state.logs.length === 0) {
    // Provide an initial sample log so the interface has content.
    state.logs = [
      {
        timestamp: Date.now(),
        summary: 'Initial log created. Use the controls above to manage logs.',
      },
    ];
    persistLogs();
  }

  refreshHistoryTable();
  attachEventHandlers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialise, { once: true });
} else {
  initialise();
}
