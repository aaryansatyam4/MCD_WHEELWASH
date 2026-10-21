import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/database/excelDb.js';

const app = createApp();

describe('Reports & Export Engine', () => {
  let adminToken = '';

  beforeAll(async () => {
    await db.init();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: '123456' });
    adminToken = login.body.token;
  });

  it('generates daily report with 24-hour breakdown and location totals', async () => {
    const res = await request(app)
      .get('/api/reports/daily?date=2026-10-21')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('daily');
    expect(res.body.hourlyData.length).toBe(24);
    expect(res.body.locations.length).toBe(3);
  });

  it('generates weekly report with 7-day movement chart and comparison', async () => {
    const res = await request(app)
      .get('/api/reports/weekly?startDate=2026-10-15&endDate=2026-10-21')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('weekly');
    expect(res.body.dailyBreakdown.length).toBe(7);
    expect(res.body.locationTotals.length).toBe(3);
  });

  it('generates monthly report with daily totals and average daily count', async () => {
    const res = await request(app)
      .get('/api/reports/monthly?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('monthly');
    expect(res.body.daysInMonth).toBe(31);
    expect(res.body.averageDailyCount).toBeDefined();
  });

  it('generates yearly report with 12-month breakdown', async () => {
    const res = await request(app)
      .get('/api/reports/yearly?year=2026')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('yearly');
    expect(res.body.monthlyBreakdown.length).toBe(12);
  });

  it('exports report to CSV format', async () => {
    const res = await request(app)
      .get('/api/reports/export?format=csv&type=daily&date=2026-10-21')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('WHEELWASH MONITOR - DAILY REPORT');
  });

  it('exports report to Excel format', async () => {
    const res = await request(app)
      .get('/api/reports/export?format=excel&type=daily&date=2026-10-21')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.body).toBeDefined();
  });
});
