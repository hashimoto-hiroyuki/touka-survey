// ========== 設定セクション ==========
const SPREADSHEET_ID = '1znspyaI-wj70aBkDfOPPrmYjPSSn3mFELW6VNfOSIbM';
const RESPONSE_SHEET_NAME = 'フォームの回答 1';  // 回答データ用
const HOSPITAL_LIST_SHEET_NAME = '医療機関リスト';  // 医療機関リスト用
const HOSPITAL_QUESTION_TITLE = '1. 受診中の歯科医院を選んでください。';
const JSON_FOLDER_NAME = 'アンケートJSON';  // JSON保存フォルダ名
const JSON_CREATED_COLUMN_NAME = 'JSON作成済み';  // フラグ列の名前

// ========== Web App エンドポイント（JSONP対応） ==========
function doGet(e) {
  const action = e.parameter.action;
  let result;
  
  try {
    switch (action) {
      case 'getHospitalList':
        result = { success: true, data: getHospitalList() };
        break;
      case 'getFormInfo':
        result = { success: true, data: getFormInfo() };
        break;
      case 'addHospital':
        result = { success: true, data: addHospital(e.parameter.name) };
        break;
      case 'deleteHospital':
        result = { success: true, data: deleteHospital(e.parameter.name) };
        break;
      case 'updateHospital':
        result = { success: true, data: updateHospital(e.parameter.oldName, e.parameter.newName) };
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  // JSONP形式で返す（CORS回避）
  const callback = e.parameter.callback;
  const jsonOutput = JSON.stringify(result);
  
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonOutput + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService.createTextOutput(jsonOutput)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ========== 医療機関リスト取得 ==========
function getHospitalList() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(HOSPITAL_LIST_SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow < 1) {
    return [];
  }

  const data = sheet.getRange(1, 1, lastRow, 1).getValues();
  let list = data.map(row => String(row[0]).trim()).filter(name => name !== '');
  return [...new Set(list)];
}

// ========== フォーム情報取得 ==========
function getFormInfo() {
  const form = FormApp.getActiveForm();
  return {
    formUrl: form.getPublishedUrl(),
    entryId: getHospitalQuestionEntryId()
  };
}

// ========== 医療機関質問のEntry ID取得 ==========
function getHospitalQuestionEntryId() {
  const form = FormApp.getActiveForm();
  const items = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE);

  for (let i = 0; i < items.length; i++) {
    if (items[i].getTitle().includes('受診中の歯科医院')) {
      return items[i].getId();
    }
  }
  return null;
}

// ========== 医療機関を追加 ==========
function addHospital(name) {
  if (!name || name.trim() === '') {
    throw new Error('医療機関名が空です');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(HOSPITAL_LIST_SHEET_NAME);
  
  const existingList = getHospitalList();
  if (existingList.includes(name.trim())) {
    throw new Error('この医療機関名は既に存在します');
  }
  
  sheet.appendRow([name.trim()]);
  syncHospitalListOnly();
  
  return { added: name.trim(), list: getHospitalList() };
}

// ========== 医療機関を削除 ==========
function deleteHospital(name) {
  if (!name) {
    throw new Error('医療機関名が指定されていません');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(HOSPITAL_LIST_SHEET_NAME);
  const lastRow = sheet.getLastRow();

  for (let i = 1; i <= lastRow; i++) {
    const cellValue = sheet.getRange(i, 1).getValue();
    if (cellValue === name) {
      sheet.deleteRow(i);
      syncHospitalListOnly();
      return { deleted: name, list: getHospitalList() };
    }
  }
  
  throw new Error('指定された医療機関名が見つかりません');
}

// ========== 医療機関名を更新 ==========
function updateHospital(oldName, newName) {
  if (!oldName || !newName) {
    throw new Error('医療機関名が指定されていません');
  }

  if (newName.trim() === '') {
    throw new Error('新しい医療機関名が空です');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(HOSPITAL_LIST_SHEET_NAME);
  const lastRow = sheet.getLastRow();

  const existingList = getHospitalList();
  if (oldName !== newName.trim() && existingList.includes(newName.trim())) {
    throw new Error('この医療機関名は既に存在します');
  }

  for (let i = 1; i <= lastRow; i++) {
    const cellValue = sheet.getRange(i, 1).getValue();
    if (cellValue === oldName) {
      sheet.getRange(i, 1).setValue(newName.trim());
      syncHospitalListOnly();
      return { oldName: oldName, newName: newName.trim(), list: getHospitalList() };
    }
  }
  
  throw new Error('指定された医療機関名が見つかりません');
}

// ========== Googleフォームの医療機関リストを同期 ==========
function syncHospitalListOnly() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(HOSPITAL_LIST_SHEET_NAME);
  const lastRow = sheet.getLastRow();

  let hList = [];
  if (lastRow >= 1) {
    hList = sheet.getRange(1, 1, lastRow, 1).getValues()
      .map(r => String(r[0]).trim())
      .filter(n => n !== "");
    hList = [...new Set(hList)];
  }

  const form = FormApp.getActiveForm();
  const items = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE);
  for (let i = 0; i < items.length; i++) {
    if (items[i].getTitle() === HOSPITAL_QUESTION_TITLE) {
      const q = items[i].asMultipleChoiceItem();
      q.setChoiceValues(hList);
      break;
    }
  }
}

// ========== フォーム全体を再構築 ==========
function rebuildFullForm() {
  const form = FormApp.getActiveForm();
  
  const items = form.getItems();
  items.forEach(item => form.deleteItem(item));

  form.setTitle('糖化アンケート_v9_3')
      .setDescription('生活習慣に関するアンケートにご協力ください。')
      .setCollectEmail(true);

  const sec1 = form.addPageBreakItem().setTitle('医療機関名');
  const q1 = form.addMultipleChoiceItem().setTitle(HOSPITAL_QUESTION_TITLE).setRequired(true);

  const sec2 = form.addPageBreakItem().setTitle('基本情報');

  const valId = FormApp.createTextValidation()
    .requireTextMatchesPattern('^[a-zA-Z0-9]+$')
    .setHelpText('半角英数字で入力してください。')
    .build();
  const q2 = form.addTextItem().setTitle('2. ID番号').setRequired(true).setValidation(valId);

  const q3 = form.addTextItem().setTitle('3. 名前').setRequired(true);
  
  const q4 = form.addListItem()
    .setTitle('4. 生年月日 - 年号')
    .setChoiceValues(['昭和', '平成', '令和'])
    .setRequired(true);
  
  const valYear = FormApp.createTextValidation()
    .requireNumber()
    .setHelpText('半角数字で入力してください。')
    .build();
  const q5 = form.addTextItem()
    .setTitle('5. - 年（半角数字）')
    .setRequired(true)
    .setValidation(valYear);
  
  const valMonth = FormApp.createTextValidation()
    .requireNumberBetween(1, 12)
    .setHelpText('1～12の半角数字で入力してください。')
    .build();
  const q6 = form.addTextItem()
    .setTitle('6. - 月（半角数字）')
    .setRequired(true)
    .setValidation(valMonth);
  
  const valDay = FormApp.createTextValidation()
    .requireNumberBetween(1, 31)
    .setHelpText('1～31の半角数字で入力してください。')
    .build();
  const q7 = form.addTextItem()
    .setTitle('7. - 日（半角数字）')
    .setRequired(true)
    .setValidation(valDay);

  const sec3 = form.addPageBreakItem().setTitle('患者情報');
  
  const q9 = form.addMultipleChoiceItem()
    .setTitle('9. 性別')
    .setChoiceValues(['男性', '女性', 'その他', '回答しない'])
    .setRequired(true);
  
  const q10 = form.addMultipleChoiceItem()
    .setTitle('10. 血液型')
    .setChoiceValues(['A型', 'B型', 'O型', 'AB型', 'わからない'])
    .setRequired(true);
  
  const valNum = FormApp.createTextValidation().requireNumber().build();
  const q11 = form.addTextItem().setTitle('11. 身長 cm').setRequired(true).setValidation(valNum);
  const q12 = form.addTextItem().setTitle('12. 体重 kg').setRequired(true).setValidation(valNum);

  const sec5 = form.addPageBreakItem().setTitle('糖尿病について');
  const q13 = form.addMultipleChoiceItem().setTitle('13. 糖尿病と診断されていますか？').setRequired(true);
  
  const sec6 = form.addPageBreakItem().setTitle('糖尿病の期間');
  const q14 = form.addMultipleChoiceItem().setTitle('14. 何年前からですか？').setChoiceValues(['3年以内', '10年以内', 'もっと以前', 'わからない']).setRequired(true);

  const sec7 = form.addPageBreakItem().setTitle('脂質異常症について');
  const q15 = form.addMultipleChoiceItem().setTitle('15. 脂質異常症と診断されていますか？').setRequired(true);
  
  const sec8 = form.addPageBreakItem().setTitle('脂質異常症の期間');
  const q16 = form.addMultipleChoiceItem().setTitle('16. 何年前からですか？').setChoiceValues(['3年以内', '3～10年以内', '10年以上前', 'わからない']).setRequired(true);

  const sec9 = form.addPageBreakItem().setTitle('ご兄弟の糖尿病歴');
  const q17 = form.addMultipleChoiceItem().setTitle('17. ご兄弟に糖尿病歴はありますか？').setRequired(true);
  
  const sec10 = form.addPageBreakItem().setTitle('ご兄弟の糖尿病の期間');
  const q18 = form.addMultipleChoiceItem().setTitle('18. 何年前からですか？').setChoiceValues(['3年以内', '3～10年以内', '10年以上前', 'わからない']).setRequired(true);

  const sec11 = form.addPageBreakItem().setTitle('ご両親の糖尿病歴');
  const q19 = form.addMultipleChoiceItem().setTitle('19. ご両親に糖尿病歴はありますか？').setRequired(true);
  
  const sec12 = form.addPageBreakItem().setTitle('ご両親の糖尿病の期間');
  const q20 = form.addMultipleChoiceItem().setTitle('20. 何年前からですか？').setChoiceValues(['3年以内', '3～10年以内', '10年以上前', 'わからない']).setRequired(true);

  const sec13 = form.addPageBreakItem().setTitle('生活習慣について');
  form.addMultipleChoiceItem().setTitle('21. 普段、運動をしてますか？').setChoiceValues(['ほぼ毎日', '週2～3回', '週1回以下', 'しない']).setRequired(true);
  form.addCheckboxItem().setTitle('22. 普段、飲む物は何ですか？').setChoiceValues(['有糖飲料(ジュース、炭酸飲料、スポーツドリンク、加糖コーヒーなど)', '無糖飲料(お茶、水、炭酸水、無糖コーヒーなど)']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('23. 普段、お菓子、スイーツなどは食べますか？').setChoiceValues(['ほぼ毎日', '週2～3回', '週1回以下', '食べない']).setRequired(true);
  
  const q24 = form.addMultipleChoiceItem().setTitle('24. お酒（ビール、ワイン、焼酎、ウイスキーなど）を習慣的に飲みますか？').setRequired(true);

  function createDrinkingSec(title, baseNum) {
    const sec = form.addPageBreakItem().setTitle(title);
    form.addListItem().setTitle(baseNum + '. お酒の種類').setChoiceValues(['ビール', '日本酒', '焼酎', 'チューハイ', 'ワイン', 'ウイスキー', 'ブランデー', '梅酒', '泡盛']).setRequired(true);
    form.addListItem().setTitle((baseNum + 1) + '. 週に何回飲みますか？(回)').setChoiceValues(['1', '2', '3', '4', '5', '6', '7']).setRequired(true);
    form.addListItem().setTitle((baseNum + 2) + '. 1回あたりのサイズ/飲み方は？').setChoiceValues(['350ml缶（缶ビール普通サイズ）', '500ml缶（缶ビール大サイズ）', '750mlビン（ワイン普通サイズ）', '375mlビン（ワインハーフボトル）', 'コップ', '水割り', 'お湯割り', 'ロック', '小ジョッキ', '中ジョッキ', '大ジョッキ']).setRequired(true);
    form.addListItem().setTitle((baseNum + 3) + '. 数量').setChoiceValues(['1', '2', '3', '4', '5', '6']).setRequired(true);
    const qNext = form.addMultipleChoiceItem().setTitle((baseNum + 4) + '. 他にもよく飲むお酒はありますか？').setRequired(true);
    return { section: sec, nextQ: qNext };
  }

  const drink1 = createDrinkingSec('飲酒の詳細【回答1】', 25);
  const drink2 = createDrinkingSec('飲酒の詳細【回答2】', 30);
  const drink3 = createDrinkingSec('飲酒の詳細【回答3】', 35);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(HOSPITAL_LIST_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  let hList = [];
  if (lastRow >= 1) {
    hList = sheet.getRange(1, 1, lastRow, 1).getValues()
      .map(r => String(r[0]).trim())
      .filter(n => n !== "");
    hList = [...new Set(hList)];
  }

  Logger.log("医療機関リスト: " + JSON.stringify(hList));

  if (hList.length > 0) {
    q1.setChoiceValues(hList);
  }

  q13.setChoices([q13.createChoice('はい', sec6), q13.createChoice('いいえ', sec7)]);
  q15.setChoices([q15.createChoice('はい', sec8), q15.createChoice('いいえ', sec9)]);
  q17.setChoices([q17.createChoice('はい', sec10), q17.createChoice('いいえ', sec11)]);
  q19.setChoices([q19.createChoice('はい', sec12), q19.createChoice('いいえ', sec13)]);
  
  sec6.setGoToPage(sec7);
  sec8.setGoToPage(sec9);
  sec10.setGoToPage(sec11);
  sec12.setGoToPage(sec13);

  q24.setChoices([
    q24.createChoice('はい（習慣的に飲む）', drink1.section),
    q24.createChoice('いいえ（ほとんど飲まない）', FormApp.PageNavigationType.SUBMIT)
  ]);

  drink1.nextQ.setChoices([
    drink1.nextQ.createChoice('ある', drink2.section),
    drink1.nextQ.createChoice('ない', FormApp.PageNavigationType.SUBMIT)
  ]);
  drink2.nextQ.setChoices([
    drink2.nextQ.createChoice('ある', drink3.section),
    drink2.nextQ.createChoice('ない', FormApp.PageNavigationType.SUBMIT)
  ]);
  drink3.nextQ.setChoices([
    drink3.nextQ.createChoice('ある', FormApp.PageNavigationType.SUBMIT),
    drink3.nextQ.createChoice('ない', FormApp.PageNavigationType.SUBMIT)
  ]);

  Logger.log("再構築完了！（医師用セクション削除版）");
}

// ========== デバッグ・テスト用関数 ==========
function getFormEntryIds() {
  const form = FormApp.getActiveForm();
  
  Logger.log('=== フォーム情報 ===');
  Logger.log('公開URL: ' + form.getPublishedUrl());
  Logger.log('');
  Logger.log('=== 全質問のEntry ID ===');
  
  const items = form.getItems();
  items.forEach(item => {
    Logger.log('Title: "' + item.getTitle() + '" | ID: ' + item.getId() + ' | Type: ' + item.getType());
  });
  
  const hospitalQ = items.find(item => item.getTitle().includes('受診中の歯科医院'));
  if (hospitalQ) {
    Logger.log('');
    Logger.log('=== 医療機関選択のEntry ID ===');
    Logger.log(hospitalQ.getId());
  }
}

function getFormPublishedUrl() {
  const form = FormApp.getActiveForm();
  Logger.log('公開URL: ' + form.getPublishedUrl());
}

function testGetHospitalList() {
  Logger.log(getHospitalList());
}

// ========== JSON保存機能 ==========

/**
 * フォーム送信時に呼び出されるトリガー関数
 */
function onFormSubmit(e) {
  try {
    const row = e.range.getRow();
    const sheet = e.range.getSheet();

    const jsonColumnIndex = getOrCreateJsonFlagColumn(sheet);

    const flagValue = sheet.getRange(row, jsonColumnIndex).getValue();
    if (flagValue === '済') {
      Logger.log('行 ' + row + ' は既にJSON作成済みのためスキップ');
      return;
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    const jsonData = buildJsonFromRow(headers, rowData);
    saveJsonToGoogleDrive(jsonData, row);

    sheet.getRange(row, jsonColumnIndex).setValue('済');

    Logger.log('行 ' + row + ' のJSON作成完了');
  } catch (error) {
    Logger.log('onFormSubmit エラー: ' + error.toString());
  }
}

/**
 * JSON作成済みフラグ列のインデックスを取得（なければ作成）
 */
function getOrCreateJsonFlagColumn(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  for (let i = 0; i < headers.length; i++) {
    if (headers[i] === JSON_CREATED_COLUMN_NAME) {
      return i + 1;
    }
  }

  const newColumnIndex = sheet.getLastColumn() + 1;
  sheet.getRange(1, newColumnIndex).setValue(JSON_CREATED_COLUMN_NAME);
  return newColumnIndex;
}

/**
 * 行データからJSONオブジェクトを構築
 */
function buildJsonFromRow(headers, rowData) {
  const json = {
    metadata: {
      createdAt: new Date().toISOString(),
      source: 'GoogleForm'
    },
    data: {}
  };

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const value = rowData[i];

    if (header === JSON_CREATED_COLUMN_NAME) {
      continue;
    }

    if (header === 'タイムスタンプ') {
      json.metadata.submittedAt = value ? new Date(value).toISOString() : null;
      continue;
    }

    if (header === 'メールアドレス') {
      json.metadata.email = value || null;
      continue;
    }

    json.data[header] = value !== '' ? value : null;
  }

  return json;
}

/**
 * JSONファイルをGoogleドライブに保存
 */
function saveJsonToGoogleDrive(jsonData, rowNumber) {
  const folder = getOrCreateJsonFolder();

  const idNumber = jsonData.data['2. ID番号'] || null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let fileName;

  if (idNumber) {
    fileName = 'survey_' + idNumber + '.json';
  } else {
    fileName = 'survey_row' + rowNumber + '_' + timestamp + '.json';
  }

  const existingFiles = folder.getFilesByName(fileName);
  while (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true);
  }

  const jsonString = JSON.stringify(jsonData, null, 2);
  folder.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);

  Logger.log('JSONファイル作成: ' + fileName);
}

/**
 * JSON保存用フォルダを取得または作成
 */
function getOrCreateJsonFolder() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ssFile = DriveApp.getFileById(ss.getId());
  const parentFolders = ssFile.getParents();

  let parentFolder;
  if (parentFolders.hasNext()) {
    parentFolder = parentFolders.next();
  } else {
    parentFolder = DriveApp.getRootFolder();
  }

  const folders = parentFolder.getFoldersByName(JSON_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder.createFolder(JSON_FOLDER_NAME);
}

/**
 * 既存データでJSON未作成のものを一括処理
 */
function processExistingDataWithoutJson() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);

  if (!sheet) {
    Logger.log('回答シートが見つかりません: ' + RESPONSE_SHEET_NAME);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('データがありません');
    return;
  }

  const jsonColumnIndex = getOrCreateJsonFlagColumn(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  let processedCount = 0;
  let skippedCount = 0;

  for (let row = 2; row <= lastRow; row++) {
    const flagValue = sheet.getRange(row, jsonColumnIndex).getValue();

    if (flagValue === '済') {
      skippedCount++;
      continue;
    }

    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (!rowData[0]) {
      continue;
    }

    const jsonData = buildJsonFromRow(headers, rowData);
    saveJsonToGoogleDrive(jsonData, row);

    sheet.getRange(row, jsonColumnIndex).setValue('済');

    processedCount++;
  }

  Logger.log('処理完了: ' + processedCount + '件作成, ' + skippedCount + '件スキップ');
}

/**
 * トリガーをセットアップする関数（初回のみ手動実行）
 */
function setupFormSubmitTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  Logger.log('フォーム送信トリガーを設定しました');
}
