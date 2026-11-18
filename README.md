# 🫀 VitalSense — Health Vitals Scanner

A real-time health vitals scanner that uses your webcam and the [VitalLens](https://www.rouast.com/vitallens/) API to measure heart rate, breathing rate, and heart rate variability (HRV) from facial video — no wearables needed.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)

## ✨ Features

- **Heart Rate** — BPM with confidence score
- **Breathing Rate** — breaths/min with Welch PSD fallback
- **HRV (SDNN & RMSSD)** — computed locally from PPG waveform peaks
- **Health Severity Assessment** — normal / elevated / high / critical with clinical guidance
- **Overall Condition Summary** — aggregated patient status with actionable recommendations
- **Real-time PPG Waveform** — live pulse wave visualization on canvas

## 🛠️ Tech Stack

| Layer    | Technology                       |
|----------|----------------------------------|
| Frontend | React 19, Vite 6, Lucide Icons  |
| Backend  | FastAPI, Uvicorn, Python 3.12   |
| AI/ML    | VitalLens API (vitallens-1.1)   |
| Signal   | SciPy (Butterworth, Welch PSD)  |

## 🚀 Quick Start

### Prerequisites

- Python 3.12
- Node.js 18+
- FFmpeg (on PATH)
- A free [VitalLens API key](https://www.rouast.com/vitallens/)

### 1. Clone & set up backend

```bash
git clone https://github.com/Manish9163/health-checker.git
cd health-checker

# Create virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
VITALLENS_API_KEY=your_api_key_here
HOST=127.0.0.1
PORT=5500
MAX_UPLOAD_MB=80
```

### 3. Build the frontend

```bash
cd frontend-react
npm install
npm run build
cd ..
```

### 4. Run the app

```bash
python backend/main.py
```

Open **http://127.0.0.1:5500** in your browser.

## 📁 Project Structure

```
health-checker/
├── backend/
│   └── main.py          # FastAPI server + VitalLens + HRV computation
├── frontend-react/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── constants/   # Metric definitions & health assessment logic
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── requirements.txt
├── .env                 # (not committed — contains API key)
└── .gitignore
```

## 📊 Health Assessment

Each metric is assessed with severity levels:

| Severity | Meaning |
|----------|---------|
| 🟢 Normal | Healthy range |
| 🟡 Elevated | Mildly outside normal — monitor |
| 🟠 High | Needs attention — consult a doctor |
| 🔴 Critical | Seek immediate medical care |

> ⚠️ **Disclaimer:** This app is for general wellness estimation only. It is **not** a medical device and cannot diagnose any condition. Consult a healthcare professional for any health concerns.

## 📄 License

MIT
