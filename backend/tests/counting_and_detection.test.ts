import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/database/excelDb.js';
import { MotionDetector } from '../src/detection/motionDetector.js';

const app = createApp();

describe('Motion Detection & Vehicle vs Human Classification', () => {
  let adminToken = '';

  beforeAll(async () => {
    await db.init();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: '123456' });
    adminToken = login.body.token;
  });

  it('MotionDetector rejects noise below sensitivity threshold', () => {
    let triggeredCount = 0;
    const detector = new MotionDetector(
      1,
      'GHAZIPUR',
      {
        roi: { x: 20, y: 35, width: 60, height: 45 },
        sensitivity: 65,
        minDurationMs: 50,
        cooldownSeconds: 2,
      },
      () => {
        triggeredCount++;
      }
    );

    // Feed noise (30% motion < 65% threshold)
    const res1 = detector.processMotion(30, 10, false);
    expect(res1.triggered).toBe(false);
    expect(detector.getStage()).toBe('IDLE');
    expect(detector.getClassification()).toBe('NONE');
    expect(triggeredCount).toBe(0);
  });

  it('MotionDetector distinguishes Human/Pedestrian and ignores counter', async () => {
    let triggeredCount = 0;
    const detector = new MotionDetector(
      1,
      'GHAZIPUR',
      {
        roi: { x: 20, y: 35, width: 60, height: 45 },
        sensitivity: 65,
        minDurationMs: 40,
        cooldownSeconds: 1,
        minTruckAreaPercent: 35,
      },
      () => {
        triggeredCount++;
      }
    );

    // Human worker walking through zone (high motion 70% >= 65%, but small spatial mass 15% and human profile)
    const res = detector.processMotion(70, 15, true);
    expect(res.classification).toBe('HUMAN_IGNORED');
    expect(res.triggered).toBe(false);
    expect(triggeredCount).toBe(0);

    // Even if human lingers for duration, they remain ignored
    await new Promise((resolve) => setTimeout(resolve, 50));
    const res2 = detector.processMotion(72, 18, true);
    expect(res2.classification).toBe('HUMAN_IGNORED');
    expect(res2.triggered).toBe(false);
    expect(triggeredCount).toBe(0);
  });

  it('MotionDetector verifies heavy truck passage and increments count by 1', async () => {
    let triggeredCount = 0;
    const detector = new MotionDetector(
      1,
      'GHAZIPUR',
      {
        roi: { x: 20, y: 35, width: 60, height: 45 },
        sensitivity: 65,
        minDurationMs: 40,
        cooldownSeconds: 1,
        minTruckAreaPercent: 35,
      },
      () => {
        triggeredCount++;
      }
    );

    // 1. Truck enters zone (motion 85% >= 65%, heavy spatial mass 75%, not human profile)
    const res1 = detector.processMotion(85, 75, false);
    expect(res1.classification).toBe('TRUCK_VERIFIED');
    expect(detector.getStage()).toBe('ENTERED_ZONE');
    expect(triggeredCount).toBe(0);

    // Wait 50ms to satisfy minDurationMs
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 2. Next frame confirms passage
    const res2 = detector.processMotion(85, 75, false);
    expect(res2.triggered).toBe(true);
    expect(res2.classification).toBe('TRUCK_VERIFIED');
    expect(detector.getStage()).toBe('IN_PASSAGE');
    expect(triggeredCount).toBe(1);

    // 3. Cooldown duplicate prevention
    detector.processMotion(10, 5, false);
    expect(detector.getStage()).toBe('COOLDOWN');
    expect(triggeredCount).toBe(1);
  });

  it('Audit history excludes COUNT_ADJUSTMENT logs as requested', async () => {
    const auditRes = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    const hasAdjustment = auditRes.body.logs.some((l: any) => l.action === 'COUNT_ADJUSTMENT');
    expect(hasAdjustment).toBe(false);
  });
});
