# Data Uploader, Grapher, and Analyzer

A lightweight browser app that lets you upload CSV/XLS/XLSX files, graph columns, and compute quick descriptive analysis.

## Features

- Upload CSV, XLS, or XLSX files.
- Automatically detects likely numeric columns.
- Build scatter, line, bar, histogram, and box plots.
- Optional aggregation (count/sum/average) for grouped bar and line charts.
- View high-level dataset overview and missing-value counts.
- Generate numeric summary statistics (min, quartiles, median, mean, max, standard deviation).
- Compute Pearson correlation matrix across numeric columns.

## Run locally

Because this is a static app, any web server works:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
