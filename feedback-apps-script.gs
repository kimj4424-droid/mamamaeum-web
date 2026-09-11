function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('피드백')
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('피드백');
  const data = JSON.parse(e && e.postData && e.postData.contents || '{}');
  const expectedSecret = PropertiesService.getScriptProperties().getProperty('FEEDBACK_WEB_APP_SECRET');

  if (!expectedSecret || data.secret !== expectedSecret) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (!data.message || typeof data.message !== 'string') {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'message가 필요합니다.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['시각', '분류', '내용', '연락처', '환경']);
  }
  const feedback = {
    timestamp: data.timestamp || new Date().toISOString(),
    category: data.category || '',
    message: data.message,
    contact: data.contact || '',
    userAgent: data.userAgent || '',
  };
  sheet.appendRow([feedback.timestamp, feedback.category, feedback.message, feedback.contact, feedback.userAgent]);
  notifyOperatorOnFeedback(feedback);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 웹 앱 doPost에서 직접 호출합니다.
 * 스크립트 속성 FEEDBACK_ALERT_EMAIL에 운영자 수신 주소를 저장하면 됩니다.
 */
function notifyOperatorOnFeedback(feedback) {
  const recipient = PropertiesService.getScriptProperties().getProperty('FEEDBACK_ALERT_EMAIL');
  if (!recipient) return;

  const rows = [
    ['시각', feedback.timestamp],
    ['분류', feedback.category],
    ['내용', feedback.message],
    ['연락처', feedback.contact],
  ].map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  MailApp.sendEmail({
    to: recipient,
    subject: '[엄마마음] 새 사용자 피드백',
    htmlBody: `<p>새 사용자 피드백이 접수되었습니다.</p><table>${rows}</table>`,
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
