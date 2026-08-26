function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('피드백')
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('피드백');
  const data = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['시각', '분류', '내용', '연락처', '환경']);
  }
  sheet.appendRow([data.timestamp, data.category, data.message, data.contact, data.userAgent]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
