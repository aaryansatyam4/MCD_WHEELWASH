import { logger } from '../utils/logger.js';
export class MotionDetector {
    locationId;
    locationName;
    config;
    stage = 'IDLE';
    zoneEnteredAt = 0;
    lastPassageAt = 0;
    zoneClearedAt = 0;
    onVehicleDetectedCallback;
    constructor(locationId, locationName, config, onVehicleDetected) {
        this.locationId = locationId;
        this.locationName = locationName;
        this.config = config;
        this.onVehicleDetectedCallback = onVehicleDetected;
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        logger.info(`Updated detection config for ${this.locationName}:`, this.config);
    }
    getConfig() {
        return { ...this.config };
    }
    getStage() {
        return this.stage;
    }
    /**
     * Process a new frame's motion level (0-100) inside the designated Wheel-Wash ROI
     */
    processMotion(motionScore) {
        const now = Date.now();
        let triggered = false;
        const threshold = this.config.sensitivity; // e.g. 65
        const isMotionSignificant = motionScore >= threshold;
        switch (this.stage) {
            case 'IDLE':
                if (isMotionSignificant) {
                    this.stage = 'ENTERED_ZONE';
                    this.zoneEnteredAt = now;
                }
                break;
            case 'ENTERED_ZONE':
                if (isMotionSignificant) {
                    const duration = now - this.zoneEnteredAt;
                    if (duration >= this.config.minDurationMs) {
                        // Valid vehicle passage detected!
                        this.stage = 'IN_PASSAGE';
                        this.lastPassageAt = now;
                        triggered = true;
                        logger.info(`[DETECTION] Valid vehicle passage detected at ${this.locationName}! Duration in zone: ${duration}ms, Motion: ${motionScore}%`);
                        if (this.onVehicleDetectedCallback) {
                            this.onVehicleDetectedCallback(this.locationId);
                        }
                    }
                }
                else {
                    // Motion dropped before meeting minimum duration - environmental noise
                    this.stage = 'IDLE';
                }
                break;
            case 'IN_PASSAGE':
                // Truck is still passing or washing
                if (!isMotionSignificant) {
                    // Zone is beginning to clear
                    this.stage = 'COOLDOWN';
                    this.zoneClearedAt = now;
                }
                break;
            case 'COOLDOWN':
                if (isMotionSignificant) {
                    // Still residual motion (e.g. trailer or water spray settling), reset clear timer
                    this.zoneClearedAt = now;
                }
                else {
                    const clearDuration = (now - this.zoneClearedAt) / 1000;
                    if (clearDuration >= this.config.cooldownSeconds) {
                        // Zone has been clear for cooldown duration, safely re-arm
                        this.stage = 'IDLE';
                    }
                }
                break;
        }
        return { stage: this.stage, triggered };
    }
    reset() {
        this.stage = 'IDLE';
        this.zoneEnteredAt = 0;
        this.zoneClearedAt = 0;
    }
}
