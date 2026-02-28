# Real-Time AI-Based Fog Removal System

> A full-stack deep learning application that removes fog from live camera feeds and video files in real time, using a Keras neural network served via a Flask REST API and displayed on a React web dashboard.

---


---

## Project Overview

**DEFOG AI** is a real-time fog removal (image dehazing) system built as a complete end-to-end pipeline:

1. A **live camera feed or video file** is captured in the browser
2. Frames are sent to a **Flask backend** via HTTP POST requests
3. The backend runs the frame through a **trained Keras CNN model**
4. The dehazed (clear) frame is returned to the browser as a base64 image
5. The **React dashboard** renders the clear output live with performance metrics

This project was built as a practical, deployable solution to a genuine road safety problem — not just a research demo.

---

## Problem Statement

Fog and haze severely reduce visibility on roads, making it dangerous for drivers, reducing the effectiveness of traffic surveillance cameras, and degrading the performance of autonomous vehicle sensors.

Key issues:
- **30%+ of weather-related accidents** globally occur due to reduced visibility
- Existing dashcam and CCTV footage becomes **unusable in foggy conditions**
- Hardware-based solutions (LIDAR, thermal cameras) are **expensive and impractical** at scale
- Most software dehazing tools are **too slow** for real-time use

---

## Solution

DEFOG AI solves this with a **software-only, real-time dehazing pipeline** that:

- Runs entirely on consumer hardware (no GPU required for basic use)
- Operates through any modern web browser — no installation for the end user
- Processes frames at approximately **6–7 frames per second** via the API
- Displays the dehazed output with live performance monitoring

---

## Features

| Feature | Description |
|---|---|
| 📷 Live Camera | Captures real-time webcam feed and dehazed it on the fly |
| 🎞️ Video Upload | Load any foggy video file for processing |
| 📊 Live FPS Counter | Displays both display FPS and backend processing FPS |
| ⏱️ Latency Monitor | Color-coded latency indicator (green < 200ms, amber < 500ms, red > 500ms) |
| 🟢 Backend Health Badge | Shows whether the Flask server is online/offline in real time |
| 💾 Save Frame | Download the current dehazed frame as a PNG image |
| ⚙️ Configurable API URL | Change the backend server address from the dashboard without code changes |
| 📱 Responsive UI | Works on desktop browsers; canvas auto-scales to any viewport |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                          │
│                                                                 │
│  Webcam / Video File                                            │
│       │                                                         │
│       ▼                                                         │
│  Canvas Capture (320px JPEG, 75% quality)                       │
│       │                                                         │
│       │   POST /process_frame   (every 150ms)                   │
│       ▼                                                         │
└───────────────────────┬─────────────────────────────────────────┘
                        │  HTTP (JSON + base64)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FLASK BACKEND (Python)                        │
│                                                                 │
│  flaskbackend.py                                                │
│       │                                                         │
│       ├── GET  /              → Health check + model status     │
│       └── POST /process_frame → Receive frame, run model        │
│                    │                                            │
│                    ▼                                            │
│         fog_removal_model.h5.keras  (Keras / TensorFlow)        │
│                    │                                            │
│                    ▼                                            │
│         Dehazed frame returned as base64 JPEG                   │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
         Browser renders dehazed frame on Canvas
```

### Data Flow

```
Frame captured  →  Downscaled to 320px  →  JPEG encode (75%)
→  base64 string  →  POST to /process_frame
→  Flask decodes  →  OpenCV preprocessing
→  Keras model inference  →  Postprocessing
→  base64 JPEG response  →  Browser renders on canvas
```

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Python 3.9 | Core language |
| Flask | REST API web framework |
| Flask-CORS | Cross-origin request handling |
| TensorFlow / Keras | Deep learning model loading and inference |
| OpenCV (`cv2`) | Image decoding, preprocessing, encoding |
| NumPy | Tensor/array manipulation |

### Frontend
| Technology | Purpose |
|---|---|
| React.js | UI framework |
| Canvas API | Real-time video frame capture and rendering |
| Fetch API | HTTP communication with Flask backend |
| Lucide React | Icon library |
| Tailwind CSS (utility classes) | Styling |

---

## Project Structure

```
fogremovalpro/
│
├── trainingdata/
│   ├── flaskbackend.py          # Flask API server — main backend file
│   ├── fog_removal_model.h5.keras  # Trained Keras dehazing model
│   ├── datatrain.py             # Model training script
│   └── testmodel.py             # Model evaluation/testing script
│
└── frontend/
    └── src/
        └── FogRemovalSystem.jsx # React dashboard component
```

---

## Installation & Setup

### Prerequisites

- Python 3.9+
- Node.js 16+
- pip
- A webcam (for live camera mode)

---

### Backend (Flask)

**Step 1 — Clone / navigate to the project folder**

```bash
cd fogremovalpro/trainingdata
```

**Step 2 — Install Python dependencies**

```bash
pip install flask flask-cors tensorflow opencv-python numpy
```

**Step 3 — Verify the model file exists**

```bash
ls fog_removal_model.h5.keras
```

If the model file is missing, run the training script first:

```bash
python datatrain.py
```

**Step 4 — Start the Flask server**

```bash
python flaskbackend.py
```

You should see:

```
* Serving Flask app 'flaskbackend'
* Debug mode: on
* Running on all addresses (0.0.0.0)
* Running on http://127.0.0.1:5000
* Running on http://172.31.10.70:5000
✅ Fixed model loaded successfully
```

The server is now running and ready to accept requests.

> ⚠️ **Important:** The server runs on `0.0.0.0` which means it is accessible from other devices on the same network. The React frontend should point to your machine's local IP (e.g., `http://172.31.10.70:5000`).

---

### Frontend (React)

**Step 1 — Install dependencies**

```bash
cd frontend
npm install
```

**Step 2 — Start the development server**

```bash
npm start
```

**Step 3 — Open in browser**

```
http://localhost:3000
```

**Step 4 — Configure the API URL**

On the dashboard, click **⚙ Config** and set the backend URL to your Flask server's address:

```
http://172.31.10.70:5000
```

Click **Save & Ping** — the dashboard will confirm if the backend is reachable and the model is loaded.

---

## Usage

### Live Camera Mode

1. Open the React dashboard in your browser
2. Ensure the backend health badge shows **BACKEND ONLINE**
3. Click **▶ Start Camera**
4. Allow camera access when prompted
5. The canvas will display the dehazed live output in real time
6. Click **Save Frame** at any time to download a PNG of the current dehazed view
7. Click **Stop** to end the session

### Video File Mode

1. Click **Upload Video** and select a foggy video file (`.mp4`, `.mov`, `.webm`, etc.)
2. The video will loop and process each frame through the AI model
3. The dehazed output plays in the canvas

---

## API Reference

### `GET /`

Health check endpoint. Returns server and model status.

**Response:**

```json
{
  "status": "Fog Removal Server Running",
  "model_loaded": true,
  "active_model": "fixed",
  "model_path": "D:/fogreact/fogremovalpro/trainingdata/fog_removal_model.h5.keras"
}
```

---

### `POST /process_frame`

Accepts a video frame and returns the dehazed version.

**Request Body:**

```json
{
  "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
}
```

| Field | Type | Description |
|---|---|---|
| `frame` | string | Base64-encoded JPEG image with data URI prefix |

**Response (Success):**

```json
{
  "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
}
```

**Response (Error):**

```json
{
  "error": "No frame provided"
}
```

**Status Codes:**

| Code | Meaning |
|---|---|
| 200 | Frame processed successfully |
| 400 | Missing or invalid frame data |
| 500 | Internal server error (model inference failed) |

---

## Model Information

| Property | Value |
|---|---|
| File | `fog_removal_model.h5.keras` |
| Framework | TensorFlow / Keras |
| Type | Convolutional Neural Network (CNN) |
| Input | RGB image (resized during preprocessing) |
| Output | Dehazed RGB image of the same dimensions |
| Training script | `datatrain.py` |

The model was trained on paired foggy/clear image datasets. It learns a pixel-level mapping from hazy inputs to clear outputs through an encoder-decoder style architecture.

---

## Configuration

### Frontend — Changing the Backend URL

Via the dashboard UI:
- Click **⚙ Config**, update the URL, click **Save & Ping**

Via code (default value in `FogRemovalSystem.jsx`):

```javascript
const DEFAULT_API = 'http://172.31.10.70:5000';
```

### Tuning Performance

In `FogRemovalSystem.jsx`:

```javascript
const THROTTLE_MS = 150;   // Milliseconds between API calls (~6-7 fps)
                           // Lower = faster but more server load
                           // Higher = slower but less load
```

Frame downscale size (smaller = faster, lower quality):

```javascript
tmp.width = 320;           // Pixel width sent to the server
```

JPEG compression quality (higher = better quality, bigger payload):

```javascript
const dataUrl = tmp.toDataURL('image/jpeg', 0.75);  // 0.0 – 1.0
```

---

## Troubleshooting

### ❌ "Backend Offline" shown on dashboard

- Confirm the Flask server is running: `python flaskbackend.py`
- Check the IP address — use `ipconfig` (Windows) or `ifconfig` (Linux/Mac) to find your local IP
- Update the API URL in the dashboard config to match your IP
- Ensure your firewall allows connections on port 5000

### ❌ CORS errors in the browser console

Add `flask-cors` to your backend and enable it:

```python
from flask_cors import CORS
app = Flask(__name__)
CORS(app)
```

Install it:

```bash
pip install flask-cors
```

### ❌ "Model not loaded" badge

- Ensure `fog_removal_model.h5.keras` is in the same directory as `flaskbackend.py`
- Check the terminal output for any model loading errors
- Re-run training if the model file is missing: `python datatrain.py`

### ❌ Very low FPS / high latency

- Reduce `THROTTLE_MS` is already at a reasonable value — do not lower below 100ms
- Reduce the downscale resolution (try `tmp.width = 256`)
- Ensure the Flask server machine has adequate CPU/RAM
- For GPU acceleration, install the GPU version of TensorFlow

### ❌ Camera not starting

- Allow camera permissions in the browser when prompted
- Use HTTPS or `localhost` — browsers block camera on insecure non-localhost origins
- Try a different browser (Chrome recommended)

---

## Future Scope

- **GPU Acceleration** — TensorRT or CUDA support for 30+ fps throughput
- **Mobile Optimization** — Lightweight MobileNet-based model for edge devices
- **IoT Deployment** — Run the backend on Raspberry Pi or NVIDIA Jetson Nano
- **Smart City Integration** — Connect to existing CCTV infrastructure via RTSP streams
- **Public REST API** — Expose the dehazing endpoint as a cloud-hosted microservice
- **Model Versioning** — A/B test multiple dehazing models via the dashboard
- **Batch Video Processing** — Upload full video files and download the dehazed version

---

## Team

| Name | Role |
|---|---|
| Priyanka.R| Full-stack development, model integration, Flask API, React dashboard |


**Institution:** [Your College Name]  
**Year:** 2026

---

## License

This project was developed for academic purposes. All rights reserved by the team.

---

> *"Fog on the road is a problem. Fog in your software is a choice. We chose clarity."*
