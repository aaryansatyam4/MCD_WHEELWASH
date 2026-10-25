import { db } from '../database/excelDb.js';
import { logger } from '../utils/logger.js';
import { getKolkataTimestamp } from '../utils/dateUtils.js';
import { MotionDetector } from '../detection/motionDetector.js';
import { SyntheticStreamer } from './syntheticStreamer.js';
import { FFmpegStreamer } from './ffmpegStreamer.js';
import { CountService } from '../services/countService.js';
import { broadcastCameraFrame, broadcastVehicleDetected, broadcastCountUpdated, broadcastCameraStatus, registerDeviceCameraHandlers, } from '../sockets/socketServer.js';
export class CameraManager {
    pipelines = new Map();
    async init() {
        logger.info('Initializing Camera Manager for 3 CCTV wheel-wash locations...');
        const cameras = db.getCameras();
        const locations = db.getLocations();
        for (const cam of cameras) {
            const loc = locations.find((l) => l.id === cam.location_id);
            const locName = loc ? loc.name : `Location ${cam.location_id}`;
            this.setupPipeline(cam, locName);
        }
        // Register handlers to receive real-time device camera frames (Webcam / USB / Bluetooth)
        registerDeviceCameraHandlers((locationId, frameBase64) => this.handleDeviceFrame(locationId, frameBase64), (locationId) => this.handleDeviceDisconnect(locationId));
    }
    setupPipeline(cam, locName) {
        let settings;
        try {
            settings = JSON.parse(cam.detection_settings);
        }
        catch {
            settings = {
                roi: { x: 20, y: 35, width: 60, height: 45 },
                sensitivity: 65,
                minDurationMs: 1200,
                cooldownSeconds: 5,
            };
        }
        let config;
        try {
            config = JSON.parse(cam.connection_configuration);
        }
        catch {
            config = {};
        }
        const detector = new MotionDetector(cam.location_id, locName, {
            roi: settings.roi,
            sensitivity: settings.sensitivity,
            minDurationMs: settings.minDurationMs,
            cooldownSeconds: settings.cooldownSeconds,
        }, (locId) => this.handleVehiclePassage(locId, cam.id));
        const syntheticStreamer = new SyntheticStreamer(cam.location_id, locName);
        const pipeline = {
            camera: cam,
            locationName: locName,
            detector,
            syntheticStreamer,
            isRunning: false,
            activeSource: config.rtspUrl && config.streamType === 'rtsp' ? 'rtsp' : 'synthetic',
            lastDeviceFrameTime: 0,
        };
        if (config.rtspUrl && config.streamType === 'rtsp') {
            pipeline.ffmpegStreamer = new FFmpegStreamer(cam.location_id, locName, config.rtspUrl, (frameBuffer) => {
                // Process incoming RTSP frame
            }, (status) => {
                cam.status = status;
                db.updateCamera(cam.id, { status });
                broadcastCameraStatus({ cameraId: cam.id, locationId: cam.location_id, status });
            });
        }
        this.pipelines.set(cam.location_id, pipeline);
        this.startPipeline(cam.location_id);
    }
    /**
     * Start stream ticking for a location
     */
    startPipeline(locationId) {
        const pipeline = this.pipelines.get(locationId);
        if (!pipeline || pipeline.isRunning)
            return;
        pipeline.isRunning = true;
        const fps = 6;
        const intervalMs = Math.round(1000 / fps);
        pipeline.streamInterval = setInterval(() => {
            if (!pipeline.isRunning)
                return;
            // If a device camera (webcam/bluetooth) is actively streaming, don't overwrite with synthetic
            const now = Date.now();
            if (pipeline.activeSource === 'device') {
                if (now - pipeline.lastDeviceFrameTime < 3000) {
                    // Device stream is active and fresh
                    return;
                }
                else {
                    // Device stream timed out, fall back to synthetic
                    pipeline.activeSource = 'synthetic';
                    logger.info(`Device camera stream for ${pipeline.locationName} timed out. Reverting to virtual feed.`);
                }
            }
            const stage = pipeline.detector.getStage();
            const detConfig = pipeline.detector.getConfig();
            const classification = pipeline.detector.getClassification();
            const confidence = pipeline.detector.getConfidence();
            const { frameBase64, motionScore, spatialMassPercent, isHumanProfile } = pipeline.syntheticStreamer.getNextFrame(stage, classification, confidence, detConfig.roi);
            if (pipeline.camera.detection_enabled === 1) {
                pipeline.detector.processMotion(motionScore, spatialMassPercent, isHumanProfile);
            }
            const currentStage = pipeline.detector.getStage();
            const currentClassification = pipeline.detector.getClassification();
            const currentConfidence = pipeline.detector.getConfidence();
            broadcastCameraFrame({
                locationId: pipeline.camera.location_id,
                cameraId: pipeline.camera.id,
                timestamp: getKolkataTimestamp(),
                frameBase64,
                motionScore,
                isVehicleDetected: currentStage === 'IN_PASSAGE' || currentClassification === 'TRUCK_VERIFIED',
                stage: currentStage,
                classification: currentClassification,
                confidence: currentConfidence,
            });
        }, intervalMs);
        logger.info(`Camera pipeline started for ${pipeline.locationName} (Location ID ${locationId})`);
    }
    /**
     * Handle incoming device camera frame from browser webcam / USB / Bluetooth camera
     */
    handleDeviceFrame(locationId, frameBase64, clientMetrics) {
        const pipeline = this.pipelines.get(locationId);
        if (!pipeline)
            return;
        pipeline.activeSource = 'device';
        pipeline.lastDeviceFrameTime = Date.now();
        // Estimate motion delta from incoming frame buffer if not provided by client
        let calculatedMotionScore = 5;
        try {
            const base64Data = frameBase64.replace(/^data:image\/\w+;base64,/, '');
            const currentBuffer = Buffer.from(base64Data, 'base64');
            if (pipeline.prevDeviceSampleBuffer && pipeline.prevDeviceSampleBuffer.length > 0) {
                let diffSum = 0;
                const sampleStep = 16;
                const minLen = Math.min(currentBuffer.length, pipeline.prevDeviceSampleBuffer.length);
                let sampleCount = 0;
                for (let i = 0; i < minLen; i += sampleStep) {
                    diffSum += Math.abs(currentBuffer[i] - pipeline.prevDeviceSampleBuffer[i]);
                    sampleCount++;
                }
                if (sampleCount > 0) {
                    const avgDiff = diffSum / sampleCount; // 0 to 255
                    calculatedMotionScore = Math.min(100, Math.round((avgDiff / 60) * 100));
                }
            }
            pipeline.prevDeviceSampleBuffer = currentBuffer;
        }
        catch {
            calculatedMotionScore = 15;
        }
        // Use optical spatial metrics from browser canvas if provided, or intelligent fallback
        const effectiveMotion = clientMetrics?.motionScore !== undefined ? clientMetrics.motionScore : calculatedMotionScore;
        const effectiveMass = clientMetrics?.spatialMassPercent !== undefined
            ? clientMetrics.spatialMassPercent
            : effectiveMotion < 40
                ? 15
                : effectiveMotion;
        const effectiveIsHuman = clientMetrics?.isHumanProfile !== undefined
            ? clientMetrics.isHumanProfile
            : effectiveMass < 30;
        // Process motion inside the detector with spatial analysis
        if (pipeline.camera.detection_enabled === 1) {
            pipeline.detector.processMotion(effectiveMotion, effectiveMass, effectiveIsHuman);
        }
        const currentStage = pipeline.detector.getStage();
        const currentClassification = pipeline.detector.getClassification();
        const currentConfidence = pipeline.detector.getConfidence();
        // Broadcast frame to ALL connected users (Admin, Monitoring, Operators)
        broadcastCameraFrame({
            locationId: pipeline.camera.location_id,
            cameraId: pipeline.camera.id,
            timestamp: getKolkataTimestamp(),
            frameBase64,
            motionScore: effectiveMotion,
            isVehicleDetected: currentStage === 'IN_PASSAGE' || currentClassification === 'TRUCK_VERIFIED',
            stage: currentStage,
            classification: currentClassification,
            confidence: currentConfidence,
        });
    }
    handleDeviceDisconnect(locationId) {
        const pipeline = this.pipelines.get(locationId);
        if (!pipeline)
            return;
        pipeline.activeSource = 'synthetic';
        pipeline.lastDeviceFrameTime = 0;
        logger.info(`Device camera disconnected for ${pipeline.locationName}. Reverted to virtual feed.`);
    }
    stopPipeline(locationId) {
        const pipeline = this.pipelines.get(locationId);
        if (!pipeline || !pipeline.isRunning)
            return;
        pipeline.isRunning = false;
        if (pipeline.streamInterval) {
            clearInterval(pipeline.streamInterval);
            pipeline.streamInterval = undefined;
        }
        if (pipeline.ffmpegStreamer) {
            pipeline.ffmpegStreamer.stop();
        }
        logger.info(`Camera pipeline stopped for ${pipeline.locationName}`);
    }
    handleVehiclePassage(locationId, cameraId) {
        const timestamp = getKolkataTimestamp();
        const pipeline = this.pipelines.get(locationId);
        const locName = pipeline ? pipeline.locationName : `Location ${locationId}`;
        const event = db.recordVehicleEvent({
            location_id: locationId,
            camera_id: cameraId,
            event_timestamp: timestamp,
            detection_source: 'automatic',
        });
        const countData = CountService.getLocationCount(locationId);
        const dashboardSummary = CountService.getDashboardSummary();
        logger.info(`[PASSAGE SAVED] Location: ${locName}, Event ID: ${event.id}, New Today Count: ${countData.total}`);
        broadcastVehicleDetected({
            locationId,
            locationName: locName,
            timestamp,
            todayCount: countData.total,
        });
        broadcastCountUpdated(dashboardSummary);
    }
    triggerSimulatedPassage(locationId) {
        const pipeline = this.pipelines.get(locationId);
        if (!pipeline)
            return false;
        pipeline.syntheticStreamer.triggerPassage();
        logger.info(`Simulated passage animation triggered for ${pipeline.locationName}`);
        return true;
    }
    triggerSimulatedHumanWalk(locationId) {
        const pipeline = this.pipelines.get(locationId);
        if (!pipeline)
            return false;
        pipeline.syntheticStreamer.triggerHumanWalk();
        logger.info(`Simulated pedestrian walk animation triggered for ${pipeline.locationName}`);
        return true;
    }
    updateCameraSettings(cameraId, settings) {
        const cam = db.getCameraById(cameraId);
        if (!cam)
            return undefined;
        let currentSettings;
        try {
            currentSettings = JSON.parse(cam.detection_settings);
        }
        catch {
            currentSettings = {
                roi: { x: 20, y: 35, width: 60, height: 45 },
                sensitivity: 65,
                minDurationMs: 1200,
                cooldownSeconds: 5,
            };
        }
        const mergedSettings = { ...currentSettings, ...settings };
        const updated = db.updateCamera(cameraId, {
            detection_settings: JSON.stringify(mergedSettings),
        });
        const pipeline = this.pipelines.get(cam.location_id);
        if (pipeline) {
            pipeline.camera = updated;
            pipeline.detector.updateConfig({
                roi: mergedSettings.roi,
                sensitivity: mergedSettings.sensitivity,
                minDurationMs: mergedSettings.minDurationMs,
                cooldownSeconds: mergedSettings.cooldownSeconds,
            });
        }
        return updated;
    }
    setDetectionEnabled(cameraId, enabled) {
        const cam = db.getCameraById(cameraId);
        if (!cam)
            return undefined;
        const updated = db.updateCamera(cameraId, {
            detection_enabled: enabled ? 1 : 0,
        });
        const pipeline = this.pipelines.get(cam.location_id);
        if (pipeline && updated) {
            pipeline.camera = updated;
        }
        return updated;
    }
    updateCameraConfig(cameraId, config) {
        const cam = db.getCameraById(cameraId);
        if (!cam)
            return undefined;
        let currentConfig;
        try {
            currentConfig = JSON.parse(cam.connection_configuration);
        }
        catch {
            currentConfig = {};
        }
        const merged = { ...currentConfig, ...config };
        const updated = db.updateCamera(cameraId, {
            connection_configuration: JSON.stringify(merged),
        });
        return updated;
    }
    getPipeline(locationId) {
        return this.pipelines.get(locationId);
    }
    shutdown() {
        logger.info('Shutting down all camera pipelines...');
        for (const [locId] of this.pipelines) {
            this.stopPipeline(locId);
        }
    }
}
export const cameraManager = new CameraManager();
