const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");
const controlsSection = document.getElementById("chartControls");
const chartPanel = document.getElementById("chartPanel");
const analysisPanel = document.getElementById("analysisPanel");
const chartType = document.getElementById("chartType");
const xColumn = document.getElementById("xColumn");
const yColumn = document.getElementById("yColumn");
const aggregation = document.getElementById("aggregation");
const renderButton = document.getElementById("renderButton");
const overview = document.getElementById("overview");
const summaryTable = document.getElementById("summaryTable");
const correlationTable = document.getElementById("correlationTable");

let rows = [];
let columns = [];
let numericColumns = [];

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    statusEl.textContent = `Loading ${file.name}...`;
    const extension = file.name.split(".").pop().toLowerCase();

    if (extension === "csv") {
      rows = await parseCSV(file);
    } else if (extension === "xls" || extension === "xlsx") {
      rows = await parseExcel(file);
    } else {
      throw new Error("Unsupported file type. Use CSV, XLS, or XLSX.");
    }

    rows = rows.filter((row) => Object.values(row).some((value) => value !== null && `${value}`.trim() !== ""));
    if (!rows.length) {
      throw new Error("No valid rows found in the uploaded file.");
    }

    columns = Object.keys(rows[0]);
    numericColumns = columns.filter((column) => isNumericColumn(column));

    buildSelectors();
    renderAnalysis();
    renderChart();

    controlsSection.hidden = false;
    chartPanel.hidden = false;
    analysisPanel.hidden = false;
    statusEl.textContent = `Loaded ${file.name}. Rows: ${rows.length}, Columns: ${columns.length}`;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
  }
});

renderButton.addEventListener("click", renderChart);
chartType.addEventListener("change", renderChart);

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (result) => resolve(result.data),
      error: reject,
    });
  });
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function isNumericColumn(column) {
  let count = 0;
  let numericCount = 0;

  for (const row of rows) {
    const value = row[column];
    if (value === "" || value === null || value === undefined) {
      continue;
    }
    count += 1;
    if (!Number.isNaN(Number(value))) {
      numericCount += 1;
    }
  }

  return count > 0 && numericCount / count >= 0.8;
}

function buildSelectors() {
  xColumn.innerHTML = "";
  yColumn.innerHTML = "";

  columns.forEach((column) => {
    xColumn.append(new Option(column, column));
  });

  numericColumns.forEach((column) => {
    yColumn.append(new Option(column, column));
  });

  if (!numericColumns.length) {
    yColumn.append(new Option("No numeric columns found", ""));
  }
}

function getNumericSeries(column) {
  return rows
    .map((row) => Number(row[column]))
    .filter((value) => !Number.isNaN(value));
}

function aggregateData(xKey, yKey, mode) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = `${row[xKey] ?? ""}`;
    const value = Number(row[yKey]);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    if (!Number.isNaN(value)) {
      groups.get(key).push(value);
    }
  });

  const x = [];
  const y = [];

  for (const [key, values] of groups.entries()) {
    x.push(key);
    if (mode === "count") {
      y.push(values.length);
    } else if (mode === "sum") {
      y.push(values.reduce((acc, val) => acc + val, 0));
    } else if (mode === "avg") {
      y.push(values.length ? values.reduce((acc, val) => acc + val, 0) / values.length : 0);
    }
  }

  return { x, y };
}

function renderChart() {
  const xKey = xColumn.value;
  const yKey = yColumn.value;
  const type = chartType.value;
  const agg = aggregation.value;

  if (!xKey || !yKey || !numericColumns.length) {
    return;
  }

  let trace;

  if ((type === "bar" || type === "line") && agg !== "none") {
    const grouped = aggregateData(xKey, yKey, agg);
    trace = {
      x: grouped.x,
      y: grouped.y,
      type: type === "line" ? "scatter" : "bar",
      mode: type === "line" ? "lines+markers" : undefined,
      name: `${agg}(${yKey}) by ${xKey}`,
    };
  } else if (type === "histogram") {
    trace = {
      x: getNumericSeries(yKey),
      type: "histogram",
      marker: { color: "#2563eb" },
      name: yKey,
    };
  } else if (type === "box") {
    trace = {
      y: getNumericSeries(yKey),
      type: "box",
      name: yKey,
      marker: { color: "#2563eb" },
    };
  } else {
    trace = {
      x: rows.map((row) => row[xKey]),
      y: rows.map((row) => Number(row[yKey])),
      type: type === "line" ? "scatter" : type,
      mode: type === "line" ? "lines+markers" : "markers",
      marker: { color: "#2563eb" },
      name: yKey,
    };
  }

  Plotly.newPlot("chart", [trace], {
    title: `${type.toUpperCase()} Chart`,
    xaxis: { title: xKey },
    yaxis: { title: yKey },
    margin: { t: 50, l: 50, r: 20, b: 50 },
  }, { responsive: true });
}

function renderAnalysis() {
  const missingValues = columns.reduce((acc, column) => {
    acc += rows.filter((row) => row[column] === "" || row[column] === null || row[column] === undefined).length;
    return acc;
  }, 0);

  overview.innerHTML = `
    <ul>
      <li><strong>Total rows:</strong> ${rows.length}</li>
      <li><strong>Total columns:</strong> ${columns.length}</li>
      <li><strong>Numeric columns:</strong> ${numericColumns.length ? numericColumns.join(", ") : "None"}</li>
      <li><strong>Missing values:</strong> ${missingValues}</li>
    </ul>
  `;

  renderNumericSummary();
  renderCorrelationMatrix();
}

function percentile(sorted, p) {
  if (!sorted.length) {
    return 0;
  }
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function calcStats(column) {
  const values = getNumericSeries(column).sort((a, b) => a - b);
  if (!values.length) {
    return null;
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;

  return {
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    mean,
    median: percentile(values, 0.5),
    q1: percentile(values, 0.25),
    q3: percentile(values, 0.75),
    std: Math.sqrt(variance),
  };
}

function renderNumericSummary() {
  if (!numericColumns.length) {
    summaryTable.innerHTML = "<p>No numeric columns available for summary.</p>";
    return;
  }

  const tableRows = numericColumns
    .map((column) => {
      const stats = calcStats(column);
      if (!stats) {
        return "";
      }

      return `
        <tr>
          <td>${column}</td>
          <td>${stats.count}</td>
          <td>${stats.min.toFixed(2)}</td>
          <td>${stats.q1.toFixed(2)}</td>
          <td>${stats.median.toFixed(2)}</td>
          <td>${stats.mean.toFixed(2)}</td>
          <td>${stats.q3.toFixed(2)}</td>
          <td>${stats.max.toFixed(2)}</td>
          <td>${stats.std.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  summaryTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Column</th>
          <th>Count</th>
          <th>Min</th>
          <th>Q1</th>
          <th>Median</th>
          <th>Mean</th>
          <th>Q3</th>
          <th>Max</th>
          <th>Std Dev</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

function pearson(a, b) {
  const length = Math.min(a.length, b.length);
  if (length < 2) {
    return 0;
  }

  const meanA = a.reduce((acc, val) => acc + val, 0) / a.length;
  const meanB = b.reduce((acc, val) => acc + val, 0) / b.length;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < length; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }

  if (denomA === 0 || denomB === 0) {
    return 0;
  }

  return numerator / Math.sqrt(denomA * denomB);
}

function renderCorrelationMatrix() {
  if (numericColumns.length < 2) {
    correlationTable.innerHTML = "<p>At least two numeric columns are required to compute correlation.</p>";
    return;
  }

  const header = numericColumns.map((column) => `<th>${column}</th>`).join("");
  const body = numericColumns
    .map((rowColumn) => {
      const rowSeries = getNumericSeries(rowColumn);
      const cells = numericColumns
        .map((colColumn) => {
          const colSeries = getNumericSeries(colColumn);
          return `<td>${pearson(rowSeries, colSeries).toFixed(2)}</td>`;
        })
        .join("");
      return `<tr><th>${rowColumn}</th>${cells}</tr>`;
    })
    .join("");

  correlationTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th></th>
          ${header}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}
