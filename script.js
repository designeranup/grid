grist.ready({ requiredAccess: 'none' });

const boxTypes = {
  'plasticeppis': { 
    rows: 9, 
    cols: 9, 
    numeric: false,
    name: '9x9 plastic grid with A1-I9 format'
  },
  '50ml': { 
    rows: 8, 
    cols: 4, 
    numeric: true,
    name: 'Box 50ml 8x4 grid'
  },
  '15ml': { 
    rows: 12, 
    cols: 6, 
    numeric: true,
    name: 'Box 15ml 12x6 grid'
  },
  'plastic15ml': {
    rows: 5,
    cols: 5,
    numeric: true,
    name: 'Box 15ml (5x5) grid'
  },
  'eppis': {
    rows: 9,
    cols: 9,
    numeric: true,
    name: 'Box eppis 9x9 grid'
  }
};

const grid = document.getElementById('grid');
const gridTitle = document.getElementById('gridTitle');
const info = document.getElementById('info');

let currentBoxId = null;
let currentBoxType = null;

function showEmptyState() {
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon"></div>
      <h3>No Box Selected</h3>
      <p>Select a row in BoxOverview to view its grid.</p>
    </div>
  `;
  info.innerHTML = `
    <div class="empty-state">
      <h3>Sample Details</h3>
      <p>Click on a position to view sample details.</p>
    </div>
  `;
  gridTitle.textContent = 'Select a Box from BoxOverview';
}

function getGridPosition(i, j, config) {
  if (config.numeric) {
    // Numeric: 01, 02, ...
    return (i * config.cols + j + 1).toString().padStart(2, '0');
  } else {
    // Alphanumeric: A1, B2, ...
    return `${String.fromCharCode(65 + i)}${j + 1}`;
  }
}

function initializeGrid(boxType, boxNumber) {
  if (!boxType) {
    showEmptyState();
    return;
  }
  const normalizedType = String(boxType).toLowerCase().trim();
  const config = boxTypes[normalizedType];
  currentBoxType = config;
  if (!config) {
    info.innerHTML = `<div class="error">Unknown box type: ${boxType}</div>`;
    showEmptyState();
    return;
  }
  grid.innerHTML = '';
  document.documentElement.style.setProperty('--cols', config.cols);
  grid.style.gridTemplateColumns = `repeat(${config.cols}, var(--cell-size))`;
  grid.style.gridTemplateRows = `repeat(${config.rows}, var(--cell-size))`;
  for (let i = 0; i < config.rows; i++) {
    for (let j = 0; j < config.cols; j++) {
      const cell = document.createElement('div');
      cell.className = 'cell empty';
      const position = getGridPosition(i, j, config);
      cell.dataset.position = position;
      cell.innerHTML = `<div class="position-label">${position}</div>`;
      cell.addEventListener('click', () => handleCellClick(position));
      grid.appendChild(cell);
    }
  }
  gridTitle.textContent = boxNumber ? `Box ${boxNumber} - ${config.name}` : config.name;
}

function normalizeSamplePosition(pos, config) {
  if (!pos) return '';
  pos = String(pos).trim();
  if (config && config.numeric) {
    let n = parseInt(pos, 10);
    if (!isNaN(n)) return n.toString().padStart(2, '0');
    return pos;
  } else {
    let match = pos.match(/^([A-Za-z])(\d{1,2})$/);
    if (match) {
      return match[1].toUpperCase() + parseInt(match[2], 10);
    }
    return pos.toUpperCase();
  }
}

async function handleCellClick(position) {
  if (!currentBoxId || !currentBoxType) return;
  try {
    const samples = await grist.rpc.invoke('viewTable', 'Samples');
    if (!samples) throw new Error('No samples data available');
    const normPos = normalizeSamplePosition(position, currentBoxType);
    const sample = samples.find(s => {
      return (
        String(s.box_id) === String(currentBoxId) &&
        normalizeSamplePosition(s.box_position, currentBoxType) === normPos
      );
    });
    if (sample) {
      info.innerHTML = `
        <h3>Sample Details</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <div>
            <p><strong>Sample ID:</strong> ${sample.sample_id || '-'}</p>
            <p><strong>Box Name:</strong> ${sample.box_name || '-'}</p>
            <p><strong>Position:</strong> ${sample.box_position || '-'}</p>
            <p><strong>Temperature:</strong> ${sample.Temperature || '-'}</p>
          </div>
          <div>
            <p><strong>Sample Time:</strong> ${sample.sample_time || '-'}</p>
            <p><strong>Box ID:</strong> ${sample.box_id || '-'}</p>
          </div>
        </div>
      `;
    } else {
      info.innerHTML = `
        <div class="empty-state">
          <h3>Position ${position}</h3>
          <p>No sample stored at this position.</p>
        </div>
      `;
    }
  } catch (error) {
    info.innerHTML = `<div class="error">Note: Sample details currently unavailable</div>`;
  }
}

grist.onRecords(table => {
  // No changes needed here for now
});

grist.onRecord(async record => {
  grid.innerHTML = '';
  info.innerHTML = '';
  gridTitle.textContent = 'Loading...';

  if (!record) {
    currentBoxId = null;
    currentBoxType = null;
    showEmptyState();
    return;
  }
  currentBoxId = record.BoxID || record.id;
  const boxFormat = record.BoxFormat || record.BoxType;
  const boxNumber = record.BoxNumber;
  initializeGrid(boxFormat, boxNumber);

  // Wait for grid to be initialized before filling cells
  setTimeout(async () => {
    try {
      const samples = await grist.rpc.invoke('viewTable', 'Samples', {
        filter: { box_id: currentBoxId }
      });
      if (!samples || !samples.length) return;
      samples.forEach(sample => {
        if (sample.box_position) {
          const normPos = normalizeSamplePosition(sample.box_position, currentBoxType);
          const cell = grid.querySelector(`.cell[data-position="${normPos}"]`);
          if (cell) {
            cell.classList.remove('empty');
            cell.classList.add('filled');
            if (sample.sample_conservation_method) {
              cell.dataset.storagetime = sample.sample_conservation_method.toLowerCase();
            }
          }
        }
      });
    } catch (err) {
      info.innerHTML = `<div class="error">Note: Sample details currently unavailable</div>`;
    }
  }, 30); // 30ms delay to ensure DOM is ready
});

showEmptyState(); 