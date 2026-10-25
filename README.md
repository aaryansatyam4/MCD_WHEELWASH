# WheelWash Monitor — Truck Counting & CCTV Monitoring System

Production-oriented Wheel Wash Truck Counting & Monitoring System for MCD municipal landfill and facility locations:
1. **GHAZIPUR** (Location 1)
2. **OKHLA** (Location 2)
3. **BHALASWA** (Location 3)

The system automatically monitors three wheel-wash locations using CCTV / RTSP cameras or connected device/Bluetooth/USB cameras, applies intelligent **Vehicle vs Human** spatial classification, and automatically increments the truck counter whenever a valid truck passage is verified.

---

## 🚀 Quick Start — How to Run

### Option 1: Run Both Backend and Frontend with One Command
From the project root (`/Users/aryansatyam/Desktop/Pesi/MCD`):
```bash
npm run dev
```

---

### Option 2: Run in Two Separate Terminal Windows (Recommended)

#### Terminal 1 — Start Backend Server:
```bash
cd /Users/aryansatyam/Desktop/Pesi/MCD/backend
npm run dev
```
- **Backend API & WebSockets:** `http://localhost:5001`
- **Excel Database File:** `backend/public/database.xlsx`
- **Excel Download URL:** `http://localhost:5001/public/database.xlsx`

#### Terminal 2 — Start Frontend Server:
```bash
cd /Users/aryansatyam/Desktop/Pesi/MCD/frontend
npm run dev
```
- **Frontend Web Dashboard:** Open `http://localhost:5173` in your browser.

---

## 📹 Real Camera Connections (Webcam, USB, Bluetooth, RTSP)

Each location panel features an **Open Camera** button:
- **Device Cameras:** Connect your laptop webcam, external USB camera, or Bluetooth/wireless camera with one click.
- **Instant Control Room Sync:** When an operator or admin connects their camera in Okhla (or Ghazipur / Bhalaswa), the live stream is immediately shared across all control room screens in real time.
- **RTSP / IP Camera Support:** Configure network RTSP URLs in the **Camera Settings** console.

---

## 🧠 AI Classification: Heavy Truck vs. Human / Pedestrian

The system distinguishes between pedestrians (facility workers, security guards, pedestrians) and commercial heavy trucks:

1. **Spatial Mass & Area:**
   - **Humans:** Small spatial mass (< 30% ROI volume) and narrow vertical aspect ratio. Flagged as `HUMAN_IGNORED`, visually highlighted in amber, and **strictly excluded from the truck counter**.
   - **Trucks:** Massive spatial volume (>= 35–90% ROI area) with broad rectangular profile. Verified as `TRUCK_VERIFIED`, highlighted in emerald green, and increments the counter by exactly 1.
2. **Optical Persistence:**
   - Fleeting environmental movements (leaves, dust, water spray glare) are rejected by the minimum duration threshold.
3. **Duplicate Prevention:**
   - Automatic cooldown latching ensures each truck is counted once regardless of passage speed.

---

## 🔑 Login Accounts (Password for all: `123456`)

| Username | Initial Password | Role | Access Scope |
|---|---|---|---|
| **admin** | `123456` | Master Admin | Full control: view all 3 sites, live cameras, configure cameras & ROI detection, user management, audit logs. |
| **monitoring** | `123456` | Central Monitoring | View-only access: all 3 live camera feeds, individual counters, combined total, reports, exports. |
| **ghazipur** | `123456` | Ghazipur Operator | Restricted to Ghazipur only: Ghazipur camera feed, counter, and Ghazipur reports. |
| **okhla** | `123456` | Okhla Operator | Restricted to Okhla only: Okhla camera feed, counter, and Okhla reports. |
| **bhalaswa** | `123456` | Bhalaswa Operator | Restricted to Bhalaswa only: Bhalaswa camera feed, counter, and Bhalaswa reports. |

*Direct login enabled with zero forced password change prompts.*

---

## 📊 Database Engine: Excel Storage (`backend/public/database.xlsx`)

All records are stored directly in Microsoft Excel format in `backend/public/database.xlsx`:

- **Worksheets:**
  1. `users`: Account credentials, hashed passwords, roles, location IDs.
  2. `locations`: Ghazipur, Okhla, Bhalaswa.
  3. `cameras`: Camera configs, RTSP URLs, detection ROI, sensitivity settings.
  4. `vehicle_events`: Timestamped vehicle passage detections.
  5. `count_adjustments`: Historical adjustments.
  6. `audit_logs`: Detailed non-repudiation audit trails (excluding manual adjustments).

You can directly open `backend/public/database.xlsx` in Microsoft Excel anytime or click the **Excel Database** download button in the top navigation bar.

---

## 🧪 Automated Test Suite
```bash
cd /Users/aryansatyam/Desktop/Pesi/MCD/backend
npm run test
```
All 15 integration and unit tests pass:
- Login authentication & role-based restrictions
- Location-level access control (operators blocked from other sites)
- **Human vs Heavy Truck classification** (human presence ignored, truck counted)
- Motion detection state machine & cooldown duplicate prevention
- Clean audit history
- Daily, Weekly, Monthly, and Yearly reports in Asia/Kolkata timezone
- CSV and Excel export downloads
