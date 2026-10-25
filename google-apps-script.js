/**
 * ==============================================================================
 * MCD WHEELWASH MONITOR — GOOGLE APPS SCRIPT SYNC INTEGRATION
 * ==============================================================================
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "No post data received"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Test ping
    if (action === "test_ping") {
      getOrCreateSheet(ss, "Summary_Dashboard", [
        "Location ID", "Location Name", "Today's Count", "Automatic Count", 
        "Manual Adjustments", "Last Passage Time", "Status", "Last Updated (IST)"
      ]);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Connected to Google Sheet successfully!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Real-time Single Vehicle Passage Event
    if (action === "vehicle_event") {
      var event = payload.data || payload;
      var sheet = getOrCreateSheet(ss, "Vehicle_Passages", [
        "Passage ID", "Date & Time (IST)", "Location", "Camera ID", "Detection Source", "Logged At"
      ]);
      sheet.appendRow([
        event.id || "",
        event.timestamp || "",
        event.locationName || "",
        event.cameraId || "",
        event.detectionSource || "automatic",
        new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      ]);
      updateDashboardCounts(ss);
    }

    // 3. Real-time Count Adjustment Event
    else if (action === "count_adjustment") {
      var adj = payload.data || payload;
      var sheet = getOrCreateSheet(ss, "Count_Adjustments", [
        "Adjustment ID", "Date", "Location", "Adjustment (+/-)", "Previous Total", "Corrected Total", "Reason", "Modified By", "Timestamp"
      ]);
      sheet.appendRow([
        adj.id || "",
        adj.reportDate || "",
        adj.locationName || "",
        adj.adjustment || 0,
        adj.previousTotal || 0,
        adj.correctedTotal || 0,
        adj.reason || "",
        adj.modifiedBy || "",
        adj.createdAt || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      ]);
      updateDashboardCounts(ss);
    }

    // 4. Real-time Audit Log
    else if (action === "audit_log") {
      var log = payload.data || payload;
      var sheet = getOrCreateSheet(ss, "Audit_Logs", [
        "Log ID", "Timestamp (IST)", "User ID / Actor", "Action", "Details"
      ]);
      sheet.appendRow([
        log.id || "",
        log.createdAt || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        log.userId ? "User #" + log.userId : "System",
        log.actionName || log.action || "",
        log.details || ""
      ]);
    }

    // 5. Full Database Synchronization (Bulk push)
    else if (action === "full_sync") {
      var data = payload.data || payload;
      syncFullDatabase(ss, data);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      action: action,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    name: "WheelWash Monitor Google Apps Script Sync Endpoint",
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      formatHeaderRow(sheet, headers.length);
    }
  }
  return sheet;
}

function formatHeaderRow(sheet, columnCount) {
  var headerRange = sheet.getRange(1, 1, 1, columnCount);
  headerRange.setBackground("#0F172A");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setFontFamily("Segoe UI");
  headerRange.setFontSize(10.5);
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
}

function syncFullDatabase(ss, data) {
  if (data.summary && data.summary.locations) {
    var summarySheet = getOrCreateSheet(ss, "Summary_Dashboard", [
      "Location ID", "Location Name", "Today's Count", "Automatic Count", 
      "Manual Adjustments", "Last Passage Time", "Status", "Last Updated (IST)"
    ]);
    summarySheet.getRange(2, 1, Math.max(1, summarySheet.getLastRow()), 8).clearContent();
    
    var summaryRows = data.summary.locations.map(function(loc) {
      return [
        loc.locationId,
        loc.locationName,
        loc.todayCount || 0,
        loc.automaticCount || 0,
        loc.manualAdjustment || 0,
        loc.lastDetectionTime || "None",
        loc.cameraStatus || "online",
        new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      ];
    });
    if (summaryRows.length > 0) {
      summarySheet.getRange(2, 1, summaryRows.length, 8).setValues(summaryRows);
      summarySheet.getRange(2, 1, summaryRows.length, 8).setHorizontalAlignment("center");
    }
  }

  if (data.events && Array.isArray(data.events)) {
    var passagesSheet = getOrCreateSheet(ss, "Vehicle_Passages", [
      "Passage ID", "Date & Time (IST)", "Location", "Camera ID", "Detection Source", "Logged At"
    ]);
    passagesSheet.getRange(2, 1, Math.max(1, passagesSheet.getLastRow()), 6).clearContent();

    var passageRows = data.events.map(function(e) {
      return [
        e.id,
        e.event_timestamp || e.timestamp,
        e.locationName || ("Location " + e.location_id),
        e.camera_id || 1,
        e.detection_source || "automatic",
        new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      ];
    });
    if (passageRows.length > 0) {
      passagesSheet.getRange(2, 1, passageRows.length, 6).setValues(passageRows);
    }
  }

  if (data.adjustments && Array.isArray(data.adjustments)) {
    var adjSheet = getOrCreateSheet(ss, "Count_Adjustments", [
      "Adjustment ID", "Date", "Location", "Adjustment (+/-)", "Previous Total", "Corrected Total", "Reason", "Modified By", "Timestamp"
    ]);
    adjSheet.getRange(2, 1, Math.max(1, adjSheet.getLastRow()), 9).clearContent();

    var adjRows = data.adjustments.map(function(a) {
      return [
        a.id,
        a.report_date || a.reportDate,
        a.locationName || ("Location " + a.location_id),
        a.adjustment,
        a.previous_total || a.previousTotal,
        a.corrected_total || a.correctedTotal,
        a.reason,
        a.modified_by || a.modifiedBy,
        a.created_at || a.createdAt
      ];
    });
    if (adjRows.length > 0) {
      adjSheet.getRange(2, 1, adjRows.length, 9).setValues(adjRows);
    }
  }

  if (data.auditLogs && Array.isArray(data.auditLogs)) {
    var auditSheet = getOrCreateSheet(ss, "Audit_Logs", [
      "Log ID", "Timestamp (IST)", "User ID / Actor", "Action", "Details"
    ]);
    auditSheet.getRange(2, 1, Math.max(1, auditSheet.getLastRow()), 5).clearContent();

    var auditRows = data.auditLogs.map(function(log) {
      return [
        log.id,
        log.created_at,
        log.user_id ? "User #" + log.user_id : "System",
        log.action,
        typeof log.details === "string" ? log.details : JSON.stringify(log.details)
      ];
    });
    if (auditRows.length > 0) {
      auditSheet.getRange(2, 1, auditRows.length, 5).setValues(auditRows);
    }
  }

  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }
}

function updateDashboardCounts(ss) {
  var summarySheet = ss.getSheetByName("Summary_Dashboard");
  if (!summarySheet) return;
  summarySheet.getRange("H2:H4").setValue(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
}
