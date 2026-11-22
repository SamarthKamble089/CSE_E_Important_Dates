function doGet() {
  const properties = PropertiesService.getScriptProperties();
  const file = DriveApp.getFileById(properties.getProperty('SCHEDULE_FILE_ID'));
  if (file.isTrashed() || file.getName() !== 'schedules.txt' || file.getMimeType() !== MimeType.PLAIN_TEXT) {
    throw new Error('Schedule file unavailable.');
  }
  const text = file.getBlob().getDataAsString('UTF-8')
    .split(/\r?\n/).filter(line => /^\s*\d+\s*\|/.test(line)).join('\n');
  const payload = JSON.stringify({ text });
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}
