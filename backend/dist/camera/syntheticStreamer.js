import { getKolkataTimestamp } from '../utils/dateUtils.js';
export class SyntheticStreamer {
    locationId;
    locationName;
    truckX = -300;
    isPassageActive = false;
    passageProgress = 0;
    frameCount = 0;
    constructor(locationId, locationName) {
        this.locationId = locationId;
        this.locationName = locationName;
    }
    /**
     * Manually trigger a simulated truck passage for demo/testing
     */
    triggerPassage() {
        if (this.isPassageActive)
            return;
        this.isPassageActive = true;
        this.passageProgress = 0;
        this.truckX = -200;
    }
    /**
     * Generate an in-memory frame as SVG data URI string (zero disk usage!)
     */
    getNextFrame(stage, roi) {
        this.frameCount++;
        const width = 640;
        const height = 360;
        // Simulate truck movement
        let motionScore = 3 + Math.sin(this.frameCount * 0.1) * 2; // Ambient baseline noise: ~3-5%
        if (this.isPassageActive) {
            this.passageProgress += 0.035;
            this.truckX = -200 + this.passageProgress * 900;
            // When truck is inside the ROI zone (approx width * roi.x / 100)
            const roiStartX = (width * roi.x) / 100;
            const roiEndX = roiStartX + (width * roi.width) / 100;
            if (this.truckX + 120 >= roiStartX && this.truckX <= roiEndX) {
                // High motion inside ROI
                motionScore = 78 + Math.random() * 15; // 78% - 93% motion
            }
            if (this.passageProgress >= 1.0) {
                this.isPassageActive = false;
                this.truckX = -300;
            }
        }
        const timestamp = getKolkataTimestamp();
        const isDetected = stage === 'IN_PASSAGE';
        const isZoneEntered = stage === 'ENTERED_ZONE';
        // SVG elements
        const roiPxX = (width * roi.x) / 100;
        const roiPxY = (height * roi.y) / 100;
        const roiPxW = (width * roi.width) / 100;
        const roiPxH = (height * roi.height) / 100;
        const roiStrokeColor = isDetected ? '#EF4444' : isZoneEntered ? '#F59E0B' : '#10B981';
        const roiLabel = isDetected
            ? 'TRUCK PASSAGE DETECTED (+1)'
            : isZoneEntered
                ? 'MOTION VERIFYING...'
                : 'WHEEL WASH ZONE (ACTIVE)';
        // Animated water spray nozzles
        const sprayParticles = Array.from({ length: 6 }, (_, i) => {
            const sprayX = 180 + i * 45;
            const sprayH = 20 + Math.sin(this.frameCount * 0.5 + i) * 12;
            return `<path d="M${sprayX},290 L${sprayX - 10},${290 - sprayH} L${sprayX + 10},${290 - sprayH} Z" fill="rgba(56, 189, 248, 0.45)" />`;
        }).join('');
        // Truck SVG element if passing
        let truckSvg = '';
        if (this.isPassageActive && this.truckX > -250 && this.truckX < width + 100) {
            const tx = Math.round(this.truckX);
            truckSvg = `
        <!-- Truck Cab & Body -->
        <g transform="translate(${tx}, 180)">
          <!-- Main Chassis -->
          <rect x="0" y="70" width="220" height="15" fill="#334155" rx="3"/>
          <!-- Dump Bed -->
          <path d="M10,70 L20,10 L150,10 L145,70 Z" fill="#0284C7" stroke="#0369A1" stroke-width="2"/>
          <text x="80" y="45" font-family="Arial, sans-serif" font-weight="bold" font-size="12" fill="#FFFFFF" text-anchor="middle">MCD TRUCK</text>
          <!-- Cab -->
          <path d="M150,70 L150,20 L195,20 L215,50 L215,70 Z" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2"/>
          <polygon points="160,28 190,28 202,48 160,48" fill="#38BDF8" opacity="0.8"/>
          <!-- Headlights -->
          <circle cx="212" cy="62" r="4" fill="#FDE047"/>
          <!-- Wheels -->
          <circle cx="35" cy="85" r="15" fill="#0F172A" stroke="#475569" stroke-width="3"/>
          <circle cx="75" cy="85" r="15" fill="#0F172A" stroke="#475569" stroke-width="3"/>
          <circle cx="180" cy="85" r="15" fill="#0F172A" stroke="#475569" stroke-width="3"/>
          <!-- Mud flaps & spray contact -->
          <rect x="20" y="80" width="3" height="15" fill="#1E293B"/>
        </g>
      `;
        }
        const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1E293B"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
          <linearGradient id="concreteGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#64748B"/>
            <stop offset="100%" stop-color="#475569"/>
          </linearGradient>
        </defs>

        <!-- Sky / Background facility -->
        <rect width="${width}" height="180" fill="url(#skyGrad)"/>
        <!-- Facility fence/structures -->
        <rect x="50" y="60" width="120" height="120" fill="#0F172A" opacity="0.4"/>
        <rect x="420" y="40" width="160" height="140" fill="#0F172A" opacity="0.3"/>

        <!-- Ground / Concrete wash bay -->
        <rect y="180" width="${width}" height="180" fill="url(#concreteGrad)"/>

        <!-- Wash bay trench -->
        <rect x="120" y="275" width="400" height="30" fill="#1E293B" rx="4"/>
        <!-- Yellow safety hatched borders -->
        <line x1="120" y1="270" x2="520" y2="270" stroke="#EAB308" stroke-width="6" stroke-dasharray="15,10"/>
        <line x1="120" y1="310" x2="520" y2="310" stroke="#EAB308" stroke-width="6" stroke-dasharray="15,10"/>

        <!-- Water Spray Nozzles & Mist -->
        ${sprayParticles}

        <!-- Passing Truck (if active) -->
        ${truckSvg}

        <!-- Wheel Wash ROI Zone Box -->
        <rect x="${roiPxX}" y="${roiPxY}" width="${roiPxW}" height="${roiPxH}"
              fill="${isDetected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.08)'}"
              stroke="${roiStrokeColor}" stroke-width="2.5" stroke-dasharray="6,4" rx="4"/>

        <!-- ROI Tag -->
        <rect x="${roiPxX}" y="${roiPxY - 24}" width="${roiLabel.length * 7.5 + 16}" height="22" fill="${roiStrokeColor}" rx="3"/>
        <text x="${roiPxX + 8}" y="${roiPxY - 8}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">${roiLabel}</text>

        <!-- Top Status Bar -->
        <rect width="${width}" height="32" fill="rgba(15, 23, 42, 0.85)"/>
        <!-- Live REC Indicator -->
        <circle cx="20" cy="16" r="5" fill="#EF4444"/>
        <text x="32" y="20" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">LIVE REC</text>

        <!-- Location Badge -->
        <rect x="110" y="6" width="100" height="20" rx="3" fill="#3B82F6"/>
        <text x="160" y="20" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${this.locationName}</text>

        <!-- Timestamp & Motion Score -->
        <text x="${width - 15}" y="20" font-family="monospace" font-size="11" fill="#E2E8F0" text-anchor="end">${timestamp} IST | MOTION: ${Math.round(motionScore)}%</text>

        <!-- Bottom Overlay Warning -->
        <rect y="${height - 22}" width="${width}" height="22" fill="rgba(15, 23, 42, 0.75)"/>
        <text x="15" y="${height - 7}" font-family="Arial, sans-serif" font-size="10" fill="#94A3B8">CAM 0${this.locationId} - RTSP GATEWAY - IN-MEMORY ONLY - NO DISK RECORDING</text>
      </svg>
    `;
        const base64 = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
        return {
            frameBase64: base64,
            motionScore: Math.round(motionScore),
        };
    }
}
