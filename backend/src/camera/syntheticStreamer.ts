import { getKolkataTimestamp } from '../utils/dateUtils.js';
import type { DetectionStage, ObjectClassification } from './types.js';

export class SyntheticStreamer {
  private locationId: number;
  private locationName: string;
  private truckX: number = -300;
  private isPassageActive: boolean = false;
  private passageProgress: number = 0;
  private isHumanWalkActive: boolean = false;
  private humanX: number = -100;
  private humanProgress: number = 0;
  private frameCount: number = 0;

  constructor(locationId: number, locationName: string) {
    this.locationId = locationId;
    this.locationName = locationName;
  }

  public triggerPassage(): void {
    if (this.isPassageActive || this.isHumanWalkActive) return;
    this.isPassageActive = true;
    this.passageProgress = 0;
    this.truckX = -200;
  }

  public triggerHumanWalk(): void {
    if (this.isPassageActive || this.isHumanWalkActive) return;
    this.isHumanWalkActive = true;
    this.humanProgress = 0;
    this.humanX = -60;
  }

  public getNextFrame(
    stage: DetectionStage,
    classification: ObjectClassification,
    confidence: number,
    roi: { x: number; y: number; width: number; height: number }
  ): {
    frameBase64: string;
    motionScore: number;
    spatialMassPercent: number;
    isHumanProfile: boolean;
  } {
    this.frameCount++;
    const width = 640;
    const height = 360;

    let motionScore = 3 + Math.sin(this.frameCount * 0.1) * 2;
    let spatialMassPercent = 5;
    let isHumanProfile = false;

    // 1. Truck Passage
    if (this.isPassageActive) {
      this.passageProgress += 0.035;
      this.truckX = -200 + this.passageProgress * 900;

      const roiStartX = (width * roi.x) / 100;
      const roiEndX = roiStartX + (width * roi.width) / 100;

      if (this.truckX + 120 >= roiStartX && this.truckX <= roiEndX) {
        motionScore = 80 + Math.random() * 12; // 80 - 92%
        spatialMassPercent = 75 + Math.random() * 15; // 75 - 90% heavy mass
        isHumanProfile = false;
      }

      if (this.passageProgress >= 1.0) {
        this.isPassageActive = false;
        this.truckX = -300;
      }
    }

    // 2. Human Walking (Worker in safety vest)
    if (this.isHumanWalkActive) {
      this.humanProgress += 0.025;
      this.humanX = -60 + this.humanProgress * 750;

      const roiStartX = (width * roi.x) / 100;
      const roiEndX = roiStartX + (width * roi.width) / 100;

      if (this.humanX >= roiStartX && this.humanX <= roiEndX) {
        motionScore = 68 + Math.random() * 6; // High motion
        spatialMassPercent = 14; // Small spatial mass (< 30%)
        isHumanProfile = true; // Narrow vertical pedestrian profile
      }

      if (this.humanProgress >= 1.0) {
        this.isHumanWalkActive = false;
        this.humanX = -100;
      }
    }

    const timestamp = getKolkataTimestamp();
    const isTruckDetected = classification === 'TRUCK_VERIFIED' || stage === 'IN_PASSAGE';
    const isHumanDetected = classification === 'HUMAN_IGNORED';

    // Bounding box dimensions
    const roiPxX = (width * roi.x) / 100;
    const roiPxY = (height * roi.y) / 100;
    const roiPxW = (width * roi.width) / 100;
    const roiPxH = (height * roi.height) / 100;

    let roiStrokeColor = '#10B981';
    let roiLabel = 'WHEEL WASH ZONE — ACTIVE';

    if (isTruckDetected) {
      roiStrokeColor = '#10B981';
      roiLabel = `TRUCK CONFIRMED (${confidence || 94}%) — COUNTED (+1)`;
    } else if (isHumanDetected) {
      roiStrokeColor = '#EAB308';
      roiLabel = `HUMAN / WORKER (${confidence || 88}%) — IGNORED`;
    }

    // Water spray nozzles
    const sprayParticles = Array.from({ length: 6 }, (_, i) => {
      const sprayX = 180 + i * 45;
      const sprayH = 20 + Math.sin(this.frameCount * 0.5 + i) * 12;
      return `<path d="M${sprayX},290 L${sprayX - 10},${290 - sprayH} L${sprayX + 10},${290 - sprayH} Z" fill="rgba(56, 189, 248, 0.45)" />`;
    }).join('');

    // Truck SVG
    let truckSvg = '';
    if (this.isPassageActive && this.truckX > -250 && this.truckX < width + 100) {
      const tx = Math.round(this.truckX);
      truckSvg = `
        <g transform="translate(${tx}, 180)">
          <rect x="0" y="70" width="220" height="15" fill="#334155" rx="3"/>
          <path d="M10,70 L20,10 L150,10 L145,70 Z" fill="#0284C7" stroke="#0369A1" stroke-width="2"/>
          <text x="80" y="45" font-family="Arial, sans-serif" font-weight="bold" font-size="12" fill="#FFFFFF" text-anchor="middle">MCD TRUCK</text>
          <path d="M150,70 L150,20 L195,20 L215,50 L215,70 Z" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2"/>
          <polygon points="160,28 190,28 202,48 160,48" fill="#38BDF8" opacity="0.8"/>
          <circle cx="212" cy="62" r="4" fill="#FDE047"/>
          <circle cx="35" cy="85" r="15" fill="#0F172A" stroke="#475569" stroke-width="3"/>
          <circle cx="75" cy="85" r="15" fill="#0F172A" stroke="#475569" stroke-width="3"/>
          <circle cx="180" cy="85" r="15" fill="#0F172A" stroke="#475569" stroke-width="3"/>
        </g>
      `;
    }

    // Human SVG (facility worker walking with yellow safety vest)
    let humanSvg = '';
    if (this.isHumanWalkActive && this.humanX > -50 && this.humanX < width + 50) {
      const hx = Math.round(this.humanX);
      humanSvg = `
        <g transform="translate(${hx}, 215)">
          <!-- Head / Helmet -->
          <circle cx="15" cy="12" r="7" fill="#FACC15"/>
          <!-- Torso with high-vis vest -->
          <rect x="9" y="19" width="12" height="22" fill="#F97316" rx="2"/>
          <!-- Reflective stripes -->
          <line x1="9" y1="26" x2="21" y2="26" stroke="#FFFFFF" stroke-width="2"/>
          <line x1="9" y1="34" x2="21" y2="34" stroke="#FFFFFF" stroke-width="2"/>
          <!-- Legs -->
          <line x1="12" y1="41" x2="10" y2="60" stroke="#1E293B" stroke-width="3"/>
          <line x1="18" y1="41" x2="20" y2="60" stroke="#1E293B" stroke-width="3"/>
        </g>
      `;
    }

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0F172A"/>
            <stop offset="100%" stop-color="#1E293B"/>
          </linearGradient>
          <linearGradient id="concreteGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#475569"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
        </defs>

        <!-- Facility Background -->
        <rect width="${width}" height="180" fill="url(#skyGrad)"/>
        <rect x="50" y="60" width="120" height="120" fill="#020617" opacity="0.5"/>
        <rect x="420" y="40" width="160" height="140" fill="#020617" opacity="0.4"/>

        <!-- Concrete Bay & Trench -->
        <rect y="180" width="${width}" height="180" fill="url(#concreteGrad)"/>
        <rect x="120" y="275" width="400" height="30" fill="#0F172A" rx="4"/>
        <line x1="120" y1="270" x2="520" y2="270" stroke="#EAB308" stroke-width="6" stroke-dasharray="15,10"/>
        <line x1="120" y1="310" x2="520" y2="310" stroke="#EAB308" stroke-width="6" stroke-dasharray="15,10"/>

        <!-- Water Spray Nozzles -->
        ${sprayParticles}

        <!-- Animated Elements -->
        ${truckSvg}
        ${humanSvg}

        <!-- Wheel Wash ROI Zone Box -->
        <rect x="${roiPxX}" y="${roiPxY}" width="${roiPxW}" height="${roiPxH}"
              fill="${isTruckDetected ? 'rgba(16, 185, 129, 0.12)' : isHumanDetected ? 'rgba(234, 179, 8, 0.12)' : 'rgba(59, 130, 246, 0.06)'}"
              stroke="${roiStrokeColor}" stroke-width="2" stroke-dasharray="6,4" rx="4"/>

        <!-- ROI Tag -->
        <rect x="${roiPxX}" y="${roiPxY - 24}" width="${roiLabel.length * 7.2 + 16}" height="22" fill="${roiStrokeColor}" rx="3"/>
        <text x="${roiPxX + 8}" y="${roiPxY - 8}" font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" fill="#FFFFFF">${roiLabel}</text>

        <!-- Top CCTV Telemetry HUD -->
        <rect width="${width}" height="32" fill="rgba(2, 6, 23, 0.9)"/>
        <circle cx="20" cy="16" r="4.5" fill="#EF4444"/>
        <text x="32" y="20" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">LIVE REC</text>

        <rect x="105" y="6" width="105" height="20" rx="3" fill="#1E3A8A"/>
        <text x="157" y="20" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${this.locationName}</text>

        <text x="${width - 15}" y="20" font-family="monospace" font-size="10.5" fill="#E2E8F0" text-anchor="end">
          ${timestamp} IST | OPTICAL MASS: ${Math.round(spatialMassPercent)}%
        </text>

        <!-- Bottom Telemetry Bar -->
        <rect y="${height - 22}" width="${width}" height="22" fill="rgba(2, 6, 23, 0.85)"/>
        <text x="15" y="${height - 7}" font-family="monospace" font-size="9.5" fill="#94A3B8">
          CAM 0${this.locationId} | AI CLASSIFIER: VEHICLE vs HUMAN (ACTIVE) | 1080P HD
        </text>
      </svg>
    `;

    const base64 = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;

    return {
      frameBase64: base64,
      motionScore: Math.round(motionScore),
      spatialMassPercent: Math.round(spatialMassPercent),
      isHumanProfile,
    };
  }
}
