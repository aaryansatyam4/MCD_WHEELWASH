import { logger } from '../utils/logger.js';
import type { DetectionStage, MotionDetectionConfig, ObjectClassification } from '../camera/types.js';

export class MotionDetector {
  private locationId: number;
  private locationName: string;
  private config: MotionDetectionConfig;
  private stage: DetectionStage = 'IDLE';
  private classification: ObjectClassification = 'NONE';
  private zoneEnteredAt: number = 0;
  private lastPassageAt: number = 0;
  private zoneClearedAt: number = 0;
  private confidence: number = 0;
  private onVehicleDetectedCallback?: (locationId: number) => void;

  constructor(
    locationId: number,
    locationName: string,
    config: MotionDetectionConfig,
    onVehicleDetected?: (locationId: number) => void
  ) {
    this.locationId = locationId;
    this.locationName = locationName;
    this.config = {
      minTruckAreaPercent: 35, // Minimum 35% spatial ROI mass required for truck
      ...config,
    };
    this.onVehicleDetectedCallback = onVehicleDetected;
  }

  public updateConfig(newConfig: Partial<MotionDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`Updated detection config for ${this.locationName}:`, this.config);
  }

  public getConfig(): MotionDetectionConfig {
    return { ...this.config };
  }

  public getStage(): DetectionStage {
    return this.stage;
  }

  public getClassification(): ObjectClassification {
    return this.classification;
  }

  public getConfidence(): number {
    return this.confidence;
  }

  /**
   * Process frame motion with Human vs Heavy Truck classification:
   * @param motionScore 0-100 overall optical motion
   * @param spatialMassPercent 0-100 estimated spatial bounding area in ROI
   * @param isHumanProfile boolean flag if aspect ratio is narrow/tall pedestrian
   */
  public processMotion(
    motionScore: number,
    spatialMassPercent: number = motionScore,
    isHumanProfile: boolean = false
  ): {
    stage: DetectionStage;
    triggered: boolean;
    classification: ObjectClassification;
    confidence: number;
  } {
    const now = Date.now();
    let triggered = false;
    const threshold = this.config.sensitivity; // e.g. 65
    const isMotionSignificant = motionScore >= threshold;
    const minTruckMass = this.config.minTruckAreaPercent || 35;

    // Classification Logic:
    // If motion is significant but spatial mass is small (< 30%) or aspect ratio indicates human pedestrian:
    const isHumanDetected = isMotionSignificant && (isHumanProfile || spatialMassPercent < minTruckMass);
    const isTruckDetected = isMotionSignificant && !isHumanProfile && spatialMassPercent >= minTruckMass;

    if (isHumanDetected) {
      this.classification = 'HUMAN_IGNORED';
      this.confidence = Math.min(95, 75 + Math.round((30 - spatialMassPercent) * 0.8));
    } else if (isTruckDetected) {
      this.classification = 'TRUCK_VERIFIED';
      this.confidence = Math.min(99, 82 + Math.round(spatialMassPercent * 0.16));
    } else {
      this.classification = 'NONE';
      this.confidence = 0;
    }

    switch (this.stage) {
      case 'IDLE':
        if (isTruckDetected) {
          this.stage = 'ENTERED_ZONE';
          this.zoneEnteredAt = now;
        } else if (isHumanDetected) {
          // Human detected in zone: Log filter and DO NOT trigger entry
          logger.debug(
            `[PEDESTRIAN FILTER] Human motion filtered at ${this.locationName} (Mass: ${spatialMassPercent}%, Motion: ${motionScore}%) - Counter Ignored`
          );
        }
        break;

      case 'ENTERED_ZONE':
        if (isTruckDetected) {
          const duration = now - this.zoneEnteredAt;
          if (duration >= this.config.minDurationMs) {
            // Valid heavy vehicle verified!
            this.stage = 'IN_PASSAGE';
            this.lastPassageAt = now;
            triggered = true;

            logger.info(
              `[TRUCK VERIFIED (+1)] Heavy truck passage confirmed at ${this.locationName} (Duration: ${duration}ms, Mass: ${spatialMassPercent}%, Confidence: ${this.confidence}%)`
            );

            if (this.onVehicleDetectedCallback) {
              this.onVehicleDetectedCallback(this.locationId);
            }
          }
        } else {
          // Dropped before duration or human profile took over
          this.stage = 'IDLE';
        }
        break;

      case 'IN_PASSAGE':
        if (!isMotionSignificant) {
          this.stage = 'COOLDOWN';
          this.zoneClearedAt = now;
        }
        break;

      case 'COOLDOWN':
        if (isMotionSignificant) {
          this.zoneClearedAt = now;
        } else {
          const clearDuration = (now - this.zoneClearedAt) / 1000;
          if (clearDuration >= this.config.cooldownSeconds) {
            this.stage = 'IDLE';
            this.classification = 'NONE';
          }
        }
        break;
    }

    return {
      stage: this.stage,
      triggered,
      classification: this.classification,
      confidence: this.confidence,
    };
  }

  public reset(): void {
    this.stage = 'IDLE';
    this.classification = 'NONE';
    this.zoneEnteredAt = 0;
    this.zoneClearedAt = 0;
  }
}
