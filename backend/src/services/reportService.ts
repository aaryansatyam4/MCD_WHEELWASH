import ExcelJS from 'exceljs';
import { db } from '../database/excelDb.js';
import { CountService } from './countService.js';
import {
  getKolkataDateString,
  calculateDateRange,
} from '../utils/dateUtils.js';

export class ReportService {
  /**
   * Daily Report: Hourly distribution + daily totals
   */
  public static getDailyReport(dateStr: string = getKolkataDateString(), locationId?: number) {
    const locations = db.getLocations().filter((l) => (locationId ? l.id === locationId : true));
    const hourlyData = CountService.getHourlyCounts(dateStr, locationId);

    const locationTotals = locations.map((loc) => {
      const counts = CountService.getLocationCount(loc.id, dateStr);
      return {
        locationId: loc.id,
        locationName: loc.name,
        automaticCount: counts.automaticCount,
        manualAdjustment: counts.manualAdjustment,
        total: counts.total,
      };
    });

    const totalTrucks = locationTotals.reduce((sum, l) => sum + l.total, 0);

    return {
      type: 'daily',
      date: dateStr,
      locations: locationTotals,
      totalTrucks,
      hourlyData,
    };
  }

  /**
   * Weekly Report: 7-day movement, daily totals, location-wise comparison
   */
  public static getWeeklyReport(startDate?: string, endDate?: string, locationId?: number) {
    const range = calculateDateRange('last7days', startDate, endDate);
    const locations = db.getLocations().filter((l) => (locationId ? l.id === locationId : true));

    // Generate list of dates between startDate and endDate
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const days: string[] = [];

    const curr = new Date(start);
    while (curr <= end) {
      days.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    const dailyBreakdown = days.map((day) => {
      const dayData: Record<string, any> = { date: day, total: 0 };
      locations.forEach((loc) => {
        const counts = CountService.getLocationCount(loc.id, day);
        dayData[loc.name.toLowerCase()] = counts.total;
        dayData.total += counts.total;
      });
      return dayData;
    });

    const locationTotals = locations.map((loc) => {
      const total = days.reduce((sum, day) => {
        return sum + CountService.getLocationCount(loc.id, day).total;
      }, 0);
      return {
        locationId: loc.id,
        locationName: loc.name,
        total,
      };
    });

    const grandTotal = locationTotals.reduce((sum, l) => sum + l.total, 0);

    return {
      type: 'weekly',
      startDate: range.startDate,
      endDate: range.endDate,
      dailyBreakdown,
      locationTotals,
      grandTotal,
    };
  }

  /**
   * Monthly Report: Daily totals, total trucks per location, combined count, avg daily count
   */
  public static getMonthlyReport(yearMonth?: string, locationId?: number) {
    const today = new Date();
    const ym = yearMonth || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const [yearStr, monthStr] = ym.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const daysInMonth = new Date(year, month, 0).getDate();
    const locations = db.getLocations().filter((l) => (locationId ? l.id === locationId : true));

    const dailyBreakdown: any[] = [];
    let grandTotal = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData: Record<string, any> = { date: dayStr, dayNumber: day, total: 0 };

      locations.forEach((loc) => {
        const counts = CountService.getLocationCount(loc.id, dayStr);
        dayData[loc.name.toLowerCase()] = counts.total;
        dayData.total += counts.total;
      });

      grandTotal += dayData.total;
      dailyBreakdown.push(dayData);
    }

    const locationTotals = locations.map((loc) => {
      let locTotal = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        locTotal += CountService.getLocationCount(loc.id, dayStr).total;
      }
      return {
        locationId: loc.id,
        locationName: loc.name,
        total: locTotal,
      };
    });

    const averageDailyCount = Math.round((grandTotal / daysInMonth) * 10) / 10;

    return {
      type: 'monthly',
      month: ym,
      daysInMonth,
      dailyBreakdown,
      locationTotals,
      grandTotal,
      averageDailyCount,
    };
  }

  /**
   * Yearly Report: Jan-Dec movement, location-wise totals, combined annual count
   */
  public static getYearlyReport(yearStr?: string, locationId?: number) {
    const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
    const locations = db.getLocations().filter((l) => (locationId ? l.id === locationId : true));

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const monthlyBreakdown = monthNames.map((name, index) => {
      const monthNum = index + 1;
      const monthPrefix = `${year}-${String(monthNum).padStart(2, '0')}`;
      const daysInMonth = new Date(year, monthNum, 0).getDate();

      const monthData: Record<string, any> = {
        month: name,
        monthIndex: monthNum,
        total: 0,
      };

      locations.forEach((loc) => {
        let locMonthTotal = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
          locMonthTotal += CountService.getLocationCount(loc.id, dayStr).total;
        }
        monthData[loc.name.toLowerCase()] = locMonthTotal;
        monthData.total += locMonthTotal;
      });

      return monthData;
    });

    const locationTotals = locations.map((loc) => {
      const total = monthlyBreakdown.reduce((sum, m) => sum + (m[loc.name.toLowerCase()] || 0), 0);
      return {
        locationId: loc.id,
        locationName: loc.name,
        total,
      };
    });

    const combinedAnnualCount = locationTotals.reduce((sum, l) => sum + l.total, 0);

    return {
      type: 'yearly',
      year,
      monthlyBreakdown,
      locationTotals,
      combinedAnnualCount,
    };
  }

  /**
   * Export reports to CSV string
   */
  public static exportToCsv(reportData: any): string {
    const rows: string[] = [];

    if (reportData.type === 'daily') {
      rows.push(`WHEELWASH MONITOR - DAILY REPORT (${reportData.date})`);
      rows.push('');
      rows.push('Location,Automatic Counts,Manual Adjustment,Total Trucks');
      reportData.locations.forEach((l: any) => {
        rows.push(`"${l.locationName}",${l.automaticCount},${l.manualAdjustment},${l.total}`);
      });
      rows.push(`"COMBINED TOTAL",,,${reportData.totalTrucks}`);
      rows.push('');
      rows.push('Hour,Ghazipur,Okhla,Bhalaswa,Hourly Total');
      reportData.hourlyData.forEach((h: any) => {
        rows.push(`"${h.hour}",${h.ghazipur},${h.okhla},${h.bhalaswa},${h.total}`);
      });
    } else if (reportData.type === 'weekly') {
      rows.push(`WHEELWASH MONITOR - WEEKLY REPORT (${reportData.startDate} to ${reportData.endDate})`);
      rows.push('');
      rows.push('Location,Total Trucks');
      reportData.locationTotals.forEach((l: any) => {
        rows.push(`"${l.locationName}",${l.total}`);
      });
      rows.push(`"COMBINED TOTAL",${reportData.grandTotal}`);
      rows.push('');
      rows.push('Date,Ghazipur,Okhla,Bhalaswa,Total');
      reportData.dailyBreakdown.forEach((d: any) => {
        rows.push(`"${d.date}",${d.ghazipur || 0},${d.okhla || 0},${d.bhalaswa || 0},${d.total}`);
      });
    } else if (reportData.type === 'monthly') {
      rows.push(`WHEELWASH MONITOR - MONTHLY REPORT (${reportData.month})`);
      rows.push('');
      rows.push(`Total Combined Count,${reportData.grandTotal}`);
      rows.push(`Average Daily Count,${reportData.averageDailyCount}`);
      rows.push('');
      rows.push('Location,Total Trucks');
      reportData.locationTotals.forEach((l: any) => {
        rows.push(`"${l.locationName}",${l.total}`);
      });
      rows.push('');
      rows.push('Date,Ghazipur,Okhla,Bhalaswa,Daily Total');
      reportData.dailyBreakdown.forEach((d: any) => {
        rows.push(`"${d.date}",${d.ghazipur || 0},${d.okhla || 0},${d.bhalaswa || 0},${d.total}`);
      });
    } else if (reportData.type === 'yearly') {
      rows.push(`WHEELWASH MONITOR - YEARLY REPORT (${reportData.year})`);
      rows.push('');
      rows.push(`Combined Annual Count,${reportData.combinedAnnualCount}`);
      rows.push('');
      rows.push('Location,Annual Total');
      reportData.locationTotals.forEach((l: any) => {
        rows.push(`"${l.locationName}",${l.total}`);
      });
      rows.push('');
      rows.push('Month,Ghazipur,Okhla,Bhalaswa,Month Total');
      reportData.monthlyBreakdown.forEach((m: any) => {
        rows.push(`"${m.month}",${m.ghazipur || 0},${m.okhla || 0},${m.bhalaswa || 0},${m.total}`);
      });
    }

    return rows.join('\n');
  }

  /**
   * Export reports to formatted Excel workbook buffer
   */
  public static async exportToExcel(reportData: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WheelWash Monitor';
    const sheet = workbook.addWorksheet('Report');

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    const headerFont: Partial<ExcelJS.Font> = {
      color: { argb: 'FFFFFFFF' },
      bold: true,
      size: 11,
    };

    if (reportData.type === 'daily') {
      sheet.addRow([`WHEELWASH MONITOR - DAILY REPORT (${reportData.date})`]);
      sheet.addRow([]);
      sheet.addRow(['Location', 'Automatic Counts', 'Manual Adjustment', 'Total Trucks']);
      const headerRow = sheet.getRow(3);
      headerRow.font = headerFont;
      headerRow.fill = headerFill;

      reportData.locations.forEach((l: any) => {
        sheet.addRow([l.locationName, l.automaticCount, l.manualAdjustment, l.total]);
      });
      sheet.addRow(['COMBINED TOTAL', '', '', reportData.totalTrucks]);
      sheet.addRow([]);

      sheet.addRow(['Hour', 'Ghazipur', 'Okhla', 'Bhalaswa', 'Hourly Total']);
      const hourlyHeader = sheet.getRow(sheet.rowCount);
      hourlyHeader.font = headerFont;
      hourlyHeader.fill = headerFill;

      reportData.hourlyData.forEach((h: any) => {
        sheet.addRow([h.hour, h.ghazipur, h.okhla, h.bhalaswa, h.total]);
      });
    } else if (reportData.type === 'weekly') {
      sheet.addRow([`WHEELWASH MONITOR - WEEKLY REPORT (${reportData.startDate} to ${reportData.endDate})`]);
      sheet.addRow([]);
      sheet.addRow(['Location', 'Total Trucks']);
      const h1 = sheet.getRow(3);
      h1.font = headerFont;
      h1.fill = headerFill;

      reportData.locationTotals.forEach((l: any) => {
        sheet.addRow([l.locationName, l.total]);
      });
      sheet.addRow(['COMBINED TOTAL', reportData.grandTotal]);
      sheet.addRow([]);

      sheet.addRow(['Date', 'Ghazipur', 'Okhla', 'Bhalaswa', 'Total']);
      const h2 = sheet.getRow(sheet.rowCount);
      h2.font = headerFont;
      h2.fill = headerFill;

      reportData.dailyBreakdown.forEach((d: any) => {
        sheet.addRow([d.date, d.ghazipur || 0, d.okhla || 0, d.bhalaswa || 0, d.total]);
      });
    } else if (reportData.type === 'monthly') {
      sheet.addRow([`WHEELWASH MONITOR - MONTHLY REPORT (${reportData.month})`]);
      sheet.addRow([`Total Combined Count: ${reportData.grandTotal}`]);
      sheet.addRow([`Average Daily Count: ${reportData.averageDailyCount}`]);
      sheet.addRow([]);
      sheet.addRow(['Location', 'Total Trucks']);
      const h1 = sheet.getRow(5);
      h1.font = headerFont;
      h1.fill = headerFill;

      reportData.locationTotals.forEach((l: any) => {
        sheet.addRow([l.locationName, l.total]);
      });
      sheet.addRow([]);

      sheet.addRow(['Date', 'Ghazipur', 'Okhla', 'Bhalaswa', 'Daily Total']);
      const h2 = sheet.getRow(sheet.rowCount);
      h2.font = headerFont;
      h2.fill = headerFill;

      reportData.dailyBreakdown.forEach((d: any) => {
        sheet.addRow([d.date, d.ghazipur || 0, d.okhla || 0, d.bhalaswa || 0, d.total]);
      });
    } else if (reportData.type === 'yearly') {
      sheet.addRow([`WHEELWASH MONITOR - YEARLY REPORT (${reportData.year})`]);
      sheet.addRow([`Combined Annual Count: ${reportData.combinedAnnualCount}`]);
      sheet.addRow([]);
      sheet.addRow(['Location', 'Annual Total']);
      const h1 = sheet.getRow(4);
      h1.font = headerFont;
      h1.fill = headerFill;

      reportData.locationTotals.forEach((l: any) => {
        sheet.addRow([l.locationName, l.total]);
      });
      sheet.addRow([]);

      sheet.addRow(['Month', 'Ghazipur', 'Okhla', 'Bhalaswa', 'Month Total']);
      const h2 = sheet.getRow(sheet.rowCount);
      h2.font = headerFont;
      h2.fill = headerFill;

      reportData.monthlyBreakdown.forEach((m: any) => {
        sheet.addRow([m.month, m.ghazipur || 0, m.okhla || 0, m.bhalaswa || 0, m.total]);
      });
    }

    // Auto-fit column widths
    sheet.columns.forEach((column) => {
      column.width = 20;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
