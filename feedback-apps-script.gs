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

/**
 * Google Forms 응답 시트에 연결한 뒤, 설치형 "양식 제출 시" 트리거로 등록하세요.
 * 스크립트 속성 FEEDBACK_ALERT_EMAIL에 운영자 수신 주소를 저장하면 됩니다.
 */
function notifyOperatorOnFeedback(e) {
  const recipient = PropertiesService.getScriptProperties().getProperty('FEEDBACK_ALERT_EMAIL');
  if (!recipient) return;

  const rows = e && e.namedValues
    ? Object.entries(e.namedValues).map(([key, values]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(values.join(', '))}</td></tr>`).join('')
    : '<tr><td>새 피드백이 접수되었습니다. 응답 시트를 확인해 주세요.</td></tr>';
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
