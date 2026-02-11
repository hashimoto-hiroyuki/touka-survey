// ========== 設定セクション ==========
const SPREADSHEET_ID = '1znspyaI-wj70aBkDfOPPrmYjPSSn3mFELW6VNfOSIbM';
const RESPONSE_SHEET_NAME = 'フォームの回答 2';  // 回答データ用
const HOSPITAL_LIST_SHEET_NAME = '医療機関リスト';  // 医療機関リスト用
const HOSPITAL_QUESTION_TITLE = '1. 受診中の歯科医院を選んでください。';
const JSON_FOLDER_NAME = 'アンケートJSON';  // JSON保存フォルダ名
const JSON_CREATED_COLUMN_NAME = 'JSON作成済み';  // フラグ列の名前
const JSON_PARENT_FOLDER_ID = '1tAUwyUb9B-WH5LrW45-ox4GZFrPJWMnB';  // 共有ドライブ「3.データシート」フォルダ
const VIEW_PASSWORD = 'touka2026';  // データ閲覧用パスワード
const SCAN_PDF_FOLDER_ID = '1blx2Ia2X9blWcYAkGKPGST8MFN3VgJGL';  // 元PDFフォルダ
const DONE_PDF_FOLDER_ID = '1iFx7ngwNSJo80bElYcqw0dyHQyhm0N0N';  // 入力済みPDFフォルダ

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
      case 'addSurveyResponse':
        const jsonStr = decodeURIComponent(e.parameter.data);
        const responseData = JSON.parse(jsonStr);
        result = { success: true, data: addSurveyResponse(responseData) };
        break;
      case 'deleteDataByNo':
        const fromNo = parseInt(e.parameter.fromNo, 10);
        const toNo = parseInt(e.parameter.toNo, 10);
        result = { success: true, data: deleteDataByNo(fromNo, toNo) };
        break;
      case 'getNoList':
        result = { success: true, data: getNoList() };
        break;
      case 'updatePdfFilename':
        const targetNo = parseInt(e.parameter.no, 10);
        const pdfName = decodeURIComponent(e.parameter.pdfFilename);
        result = { success: true, data: updatePdfFilename(targetNo, pdfName) };
        break;
      case 'updateSourceToOCR':
        const sourceNo = parseInt(e.parameter.no, 10);
        result = { success: true, data: updateSourceToOCR(sourceNo) };
        break;
      case 'viewData':
        if (e.parameter.password === VIEW_PASSWORD) {
          result = { success: true, data: getViewData() };
        } else {
          result = { success: false, error: 'パスワードが正しくありません' };
        }
        break;
      case 'getUnprocessedPdfs':
        result = { success: true, data: getUnprocessedPdfs() };
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
  // ★ ListItem（プルダウン）を検索 ★
  const items = form.getItems(FormApp.ItemType.LIST);

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

  // ★ ListItem（プルダウン）を検索 ★
  const items = form.getItems(FormApp.ItemType.LIST);
  for (let i = 0; i < items.length; i++) {
    if (items[i].getTitle() === HOSPITAL_QUESTION_TITLE) {
      const q = items[i].asListItem();
      q.setChoiceValues(hList);
      break;
    }
  }
}

// ========== フォーム全体を再構築 ==========
function rebuildFullForm() {
  const form = FormApp.getActiveForm();

  // --- 1. 既存の質問をすべて削除 ---
  const items = form.getItems();
  items.forEach(item => form.deleteItem(item));

  // --- 2. 基本設定 ---
  form.setTitle('糖化アンケート_v9_3')
      .setDescription('生活習慣に関するアンケートにご協力ください。')
      .setCollectEmail(true);

  // --- 3. セクションと質問の作成 ---

  // セクション1: 医療機関選択
  const sec1 = form.addPageBreakItem().setTitle('医療機関名');
  // ★ ListItem（プルダウン）を使用 - プリフィルURLに対応 ★
  const q1 = form.addListItem().setTitle(HOSPITAL_QUESTION_TITLE).setRequired(true);

  // セクション2: 基本情報
  const sec2 = form.addPageBreakItem().setTitle('基本情報');

  // ID番号（Q2）
  const valId = FormApp.createTextValidation()
    .requireTextMatchesPattern('^[a-zA-Z0-9+_\\-]+$')
    .setHelpText('半角英数字・記号（+ _ -）で入力してください。')
    .build();
  const q2 = form.addTextItem().setTitle('2. ID番号').setRequired(true).setValidation(valId);

  // 名前（Q3）- カタカナのみ
  const valKatakana = FormApp.createTextValidation()
    .requireTextMatchesPattern('^[ァ-ヶー　 ]+$')
    .setHelpText('カタカナで入力してください。')
    .build();
  const q3 = form.addTextItem().setTitle('3. 名前（カタカナ）').setRequired(true).setValidation(valKatakana);

  // 生年月日（Q4-Q7）- 4つの質問に分割
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

  // セクション3: 患者情報（性別・血液型・身長・体重）
  const sec3 = form.addPageBreakItem().setTitle('患者情報');

  // 性別（Q9）
  const q9 = form.addMultipleChoiceItem()
    .setTitle('9. 性別')
    .setChoiceValues(['男性', '女性', 'その他', '回答しない'])
    .setRequired(true);

  // 血液型（Q10）
  const q10 = form.addMultipleChoiceItem()
    .setTitle('10. 血液型')
    .setChoiceValues(['A型', 'B型', 'O型', 'AB型', 'わからない'])
    .setRequired(true);

  // 身長・体重（Q11,12）
  const valNum = FormApp.createTextValidation().requireNumber().build();
  const q11 = form.addTextItem().setTitle('11. 身長 cm').setRequired(true).setValidation(valNum);
  const q12 = form.addTextItem().setTitle('12. 体重 kg').setRequired(true).setValidation(valNum);

  // --- 糖尿病・疾患系セクション ---

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

  // --- 生活習慣セクション ---
  const sec13 = form.addPageBreakItem().setTitle('生活習慣について');
  form.addMultipleChoiceItem().setTitle('21. 普段、運動をしてますか？').setChoiceValues(['ほぼ毎日', '週2～3回', '週1回以下', 'しない']).setRequired(true);
  form.addCheckboxItem().setTitle('22. 普段、飲む物は何ですか？').setChoiceValues(['有糖飲料(ジュース、炭酸飲料、スポーツドリンク、加糖コーヒーなど)', '無糖飲料(お茶、水、炭酸水、無糖コーヒーなど)']).setRequired(true);
  form.addMultipleChoiceItem().setTitle('23. 普段、お菓子、スイーツなどは食べますか？').setChoiceValues(['ほぼ毎日', '週2～3回', '週1回以下', '食べない']).setRequired(true);

  const q24 = form.addMultipleChoiceItem().setTitle('24. お酒（ビール、ワイン、焼酎、ウイスキーなど）を習慣的に飲みますか？').setRequired(true);

  // --- 飲酒詳細セクション生成関数 ---
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

  // --- 4. 病院リスト取得と紐付け ---
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

  // --- 5. 条件分岐の設定 ---
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

// ========== POSTエンドポイント（OCR変換データ受信用） ==========
function doPost(e) {
  let result;

  try {
    let body;
    // フォームPOST（iframe経由）の場合は e.parameter.payload を使用
    if (e.parameter && e.parameter.payload) {
      body = JSON.parse(e.parameter.payload);
    } else {
      body = JSON.parse(e.postData.contents);
    }
    const action = body.action;

    switch (action) {
      case 'addSurveyResponse':
        result = { success: true, data: addSurveyResponse(body.data) };
        break;
      case 'savePdfCopy':
        result = { success: true, data: savePdfToGoogleDrive(body.pdfBase64, body.rowNumber, body.idNumber, body.duplicateCount, body.originalFilename) };
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * OCR変換済みデータをスプレッドシートに行追加
 * @param {Object} data - スプレッドシートの列ヘッダーをキーとしたデータ
 * @returns {Object} 結果（追加行番号、重複チェック結果）
 */
function addSurveyResponse(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);

  // ヘッダー行を取得
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // 重複チェック（同じID番号があるか確認、ただしブロックはしない）
  const idColumn = headers.indexOf('2. ID番号');
  const newId = data['2. ID番号'];
  const lastRow = sheet.getLastRow();
  let duplicateCount = 0;

  if (idColumn >= 0 && newId) {
    if (lastRow > 1) {
      const existingIds = sheet.getRange(2, idColumn + 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < existingIds.length; i++) {
        if (String(existingIds[i][0]).trim() === String(newId).trim()) {
          duplicateCount++;
        }
      }
    }
  }

  // ヘッダーの順序に合わせてデータ配列を構築
  const newRow = lastRow + 1;

  const rowData = headers.map(header => {
    if (header === 'No.') {
      // 通し番号を自動採番（既存データの最大No. + 1）
      if (lastRow > 1) {
        const noColIndex = headers.indexOf('No.');
        const existingNos = sheet.getRange(2, noColIndex + 1, lastRow - 1, 1).getValues();
        let maxNo = 0;
        for (let i = 0; i < existingNos.length; i++) {
          const num = Number(existingNos[i][0]);
          if (!isNaN(num) && num > maxNo) maxNo = num;
        }
        return maxNo + 1;
      }
      return 1;
    }
    if (header === 'タイムスタンプ') {
      return new Date();  // 現在時刻
    }
    if (header === 'メールアドレス') {
      return '';  // OCRからの送信にはメールなし
    }
    if (header === JSON_CREATED_COLUMN_NAME) {
      return '';  // JSON作成済みフラグは空
    }
    return data[header] !== undefined ? data[header] : '';
  });

  // 最終行の次に追加
  sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);

  // JSON保存（共有ドライブ）
  try {
    const jsonData = {
      metadata: {
        createdAt: new Date().toISOString(),
        source: 'OCR'
      },
      data: {}
    };
    for (let key in data) {
      jsonData.data[key] = data[key];
    }
    saveJsonToGoogleDrive(jsonData, newRow);

    // JSON作成済みフラグを設定
    const jsonColIndex = headers.indexOf(JSON_CREATED_COLUMN_NAME);
    if (jsonColIndex >= 0) {
      sheet.getRange(newRow, jsonColIndex + 1).setValue('済');
    }
  } catch (jsonError) {
    Logger.log('JSON保存エラー（スプレッドシート追加は成功）: ' + jsonError.toString());
  }

  const resultMsg = duplicateCount > 0
    ? 'データを行 ' + newRow + ' に追加しました。（同一ID ' + newId + ' の ' + (duplicateCount + 1) + '件目）'
    : 'データを行 ' + newRow + ' に追加しました。';

  return {
    status: 'success',
    message: resultMsg,
    row: newRow,
    id: newId || null,
    duplicateCount: duplicateCount
  };
}

// ========== JSON保存機能 ==========

/**
 * フォーム送信時に呼び出されるトリガー関数
 */
function onFormSubmit(e) {
  try {
    const row = e.range.getRow();
    const sheet = e.range.getSheet();

    // No.列の自動採番
    const allHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const noColIndex = allHeaders.indexOf('No.');
    if (noColIndex >= 0) {
      // 既存データの最大No.を取得して+1
      let maxNo = 0;
      if (row > 2) {
        const existingNos = sheet.getRange(2, noColIndex + 1, row - 2, 1).getValues();
        for (let i = 0; i < existingNos.length; i++) {
          const num = Number(existingNos[i][0]);
          if (!isNaN(num) && num > maxNo) maxNo = num;
        }
      }
      sheet.getRange(row, noColIndex + 1).setValue(maxNo + 1);
    }

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

    if (header === JSON_CREATED_COLUMN_NAME || header === 'No.') {
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
 * ファイル名形式: No_ソース_ID_日付.json
 * 例: 001_Form_211_20260210.json, 057_OCR_123_20260210.json
 */
function saveJsonToGoogleDrive(jsonData, rowNumber) {
  const folder = getOrCreateJsonFolder();

  // No.を取得（スプレッドシートから）
  let noStr = '';
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const noColIndex = headers.indexOf('No.');
    if (noColIndex >= 0 && rowNumber >= 2) {
      const noValue = sheet.getRange(rowNumber, noColIndex + 1).getValue();
      if (noValue) noStr = String(noValue).padStart(3, '0');
    }
  } catch (e) {
    // No.取得失敗時はrow番号で代替
  }
  if (!noStr) noStr = String(rowNumber).padStart(3, '0');

  // ソース判定
  const source = jsonData.metadata.source || 'Unknown';
  const sourceLabel = (source === 'OCR') ? 'OCR' : 'Form';

  // ID番号
  const idNumber = jsonData.data['2. ID番号'] || 'noID';

  // 日付（YYYYMMDD）
  const now = new Date();
  const dateStr = now.getFullYear()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');

  // 同じIDのファイルが既にあれば (2), (3)... を付与
  // No.に関係なく、ソース_ID_日付 が同じものをカウント
  const idPattern = '_' + sourceLabel + '_' + idNumber + '_';
  const allFiles = folder.getFiles();
  let sameIdCount = 0;
  while (allFiles.hasNext()) {
    const f = allFiles.next();
    if (f.getName().indexOf(idPattern) >= 0) {
      sameIdCount++;
    }
  }

  const baseName = noStr + '_' + sourceLabel + '_' + idNumber + '_' + dateStr;
  let fileName;
  if (sameIdCount > 0) {
    fileName = baseName + '(' + (sameIdCount + 1) + ').json';
  } else {
    fileName = baseName + '.json';
  }

  const jsonString = JSON.stringify(jsonData, null, 2);
  folder.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);

  Logger.log('JSONファイル作成: ' + fileName);
}

/**
 * PDFコピーをGoogleドライブに保存
 * JSONファイルと同じフォルダに同じ命名規則（拡張子だけ.pdf）で保存
 */
function savePdfToGoogleDrive(pdfBase64, rowNumber, idNumber, duplicateCount, originalFilename) {
  const folder = getOrCreateJsonFolder();

  // No.を取得（スプレッドシートから）
  let noStr = '';
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const noColIndex = headers.indexOf('No.');
    if (noColIndex >= 0 && rowNumber >= 2) {
      const noValue = sheet.getRange(rowNumber, noColIndex + 1).getValue();
      if (noValue) noStr = String(noValue).padStart(3, '0');
    }
  } catch (e) {
    // No.取得失敗時はrow番号で代替
  }
  if (!noStr) noStr = String(rowNumber).padStart(3, '0');

  // 日付（YYYYMMDD）
  const now = new Date();
  const dateStr = now.getFullYear()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');

  const id = idNumber || 'noID';

  const baseName = noStr + '_OCR_' + id + '_' + dateStr;

  // 同じIDのPDFファイルが既にあれば (2), (3)... を付与
  const idPattern = '_OCR_' + id + '_';
  const allFiles = folder.getFiles();
  let sameIdPdfCount = 0;
  while (allFiles.hasNext()) {
    const f = allFiles.next();
    const name = f.getName();
    if (name.indexOf(idPattern) >= 0 && name.endsWith('.pdf')) {
      sameIdPdfCount++;
    }
  }

  let fileName;
  if (sameIdPdfCount > 0) {
    fileName = baseName + '(' + (sameIdPdfCount + 1) + ').pdf';
  } else {
    fileName = baseName + '.pdf';
  }

  // Base64デコードしてPDFファイルとして保存
  const pdfBlob = Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', fileName);
  folder.createFile(pdfBlob);

  Logger.log('PDFコピー作成: ' + fileName + ' (元: ' + originalFilename + ')');

  // 元PDFをスキャンPDFフォルダから入力済みPDFフォルダへ移動
  let movedOriginal = false;
  if (originalFilename) {
    try {
      const scanFolder = DriveApp.getFolderById(SCAN_PDF_FOLDER_ID);
      const doneFolder = DriveApp.getFolderById(DONE_PDF_FOLDER_ID);
      const matchFiles = scanFolder.getFilesByName(originalFilename);
      if (matchFiles.hasNext()) {
        const origFile = matchFiles.next();
        origFile.moveTo(doneFolder);
        movedOriginal = true;
        Logger.log('元PDF移動: ' + originalFilename + ' → 入力済みPDFフォルダ');
      }
    } catch (moveErr) {
      Logger.log('元PDF移動エラー（PDFコピーは成功）: ' + moveErr.toString());
    }
  }

  return {
    fileName: fileName,
    originalFilename: originalFilename,
    movedOriginal: movedOriginal
  };
}

/**
 * JSON保存用フォルダを取得または作成
 * 共有ドライブ「3.データシート」フォルダ内に作成
 */
function getOrCreateJsonFolder() {
  const parentFolder = DriveApp.getFolderById(JSON_PARENT_FOLDER_ID);

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

// ========== No.列の管理 ==========

/**
 * スプレッドシートのA列に「No.」列を挿入し、既存データに通し番号を振る
 * ※初回のみ手動実行する関数
 */
function insertNoColumn() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);

  if (!sheet) {
    Logger.log('回答シートが見つかりません: ' + RESPONSE_SHEET_NAME);
    return;
  }

  // 既にNo.列があるか確認
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (existingHeaders.indexOf('No.') >= 0) {
    Logger.log('No.列は既に存在します。backfillNoColumn() で欠番を埋めてください。');
    return;
  }

  // A列に列を挿入
  sheet.insertColumnBefore(1);

  // ヘッダーに「No.」を設定
  sheet.getRange(1, 1).setValue('No.');

  // 既存データに通し番号を振る
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const numbers = [];
    for (let i = 1; i <= lastRow - 1; i++) {
      numbers.push([i]);
    }
    sheet.getRange(2, 1, lastRow - 1, 1).setValues(numbers);
  }

  Logger.log('No.列を挿入し、' + (lastRow - 1) + '件に通し番号を付与しました。');
}

/**
 * No.列で番号が空の行に通し番号を振る（バックフィル）
 */
function backfillNoColumn() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const noColIndex = headers.indexOf('No.');

  if (noColIndex < 0) {
    Logger.log('No.列が見つかりません。先に insertNoColumn() を実行してください。');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('データがありません');
    return;
  }

  const noValues = sheet.getRange(2, noColIndex + 1, lastRow - 1, 1).getValues();

  // 既存の最大No.を取得
  let maxNo = 0;
  for (let i = 0; i < noValues.length; i++) {
    const num = Number(noValues[i][0]);
    if (!isNaN(num) && num > maxNo) maxNo = num;
  }

  // 空のセルに番号を振る
  let filledCount = 0;
  for (let i = 0; i < noValues.length; i++) {
    if (noValues[i][0] === '' || noValues[i][0] === null || noValues[i][0] === undefined) {
      maxNo++;
      sheet.getRange(i + 2, noColIndex + 1).setValue(maxNo);
      filledCount++;
    }
  }

  Logger.log('バックフィル完了: ' + filledCount + '件にNo.を付与（最大No.: ' + maxNo + '）');
}

/**
 * No.列の全データをクリアし、1から通し番号を振り直す
 */
function resetNoColumn() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const noColIndex = headers.indexOf('No.');

  if (noColIndex < 0) {
    Logger.log('No.列が見つかりません。');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('データがありません');
    return;
  }

  // 全行に1から連番を振る
  const numbers = [];
  for (let i = 1; i <= lastRow - 1; i++) {
    numbers.push([i]);
  }
  sheet.getRange(2, noColIndex + 1, lastRow - 1, 1).setValues(numbers);

  Logger.log('No.列をリセットしました。1〜' + (lastRow - 1) + ' の通し番号を付与。');
}

/**
 * 指定No.範囲のデータを削除（スプレッドシート行 + JSONファイル）
 * ※ resetNoColumn() の前に実行すること（リナンバリング前のNo.でファイルを特定するため）
 * 使い方: deleteDataByNo(50, 54) → No.50〜54を削除
 */
function deleteDataByNo(fromNo, toNo) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const noColIndex = headers.indexOf('No.');

  if (noColIndex < 0) {
    Logger.log('No.列が見つかりません。');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('データがありません。');
    return;
  }

  // --- 1. JSONファイルを削除（ゴミ箱に移動） ---
  const folder = getOrCreateJsonFolder();
  const allFiles = folder.getFiles();
  let deletedFiles = 0;

  while (allFiles.hasNext()) {
    const file = allFiles.next();
    const fileName = file.getName();
    // ファイル名の先頭3桁のNo.を取得（例: "052_OCR_A138_..." → 52）
    const match = fileName.match(/^(\d{3})_/);
    if (match) {
      const fileNo = parseInt(match[1], 10);
      if (fileNo >= fromNo && fileNo <= toNo) {
        file.setTrashed(true);
        Logger.log('JSONファイル削除: ' + fileName);
        deletedFiles++;
      }
    }
  }

  // --- 2. スプレッドシートの行を削除（下の行から削除して行番号のずれを防ぐ） ---
  const noValues = sheet.getRange(2, noColIndex + 1, lastRow - 1, 1).getValues();
  let deletedRows = 0;

  for (let i = noValues.length - 1; i >= 0; i--) {
    const no = Number(noValues[i][0]);
    if (no >= fromNo && no <= toNo) {
      sheet.deleteRow(i + 2);
      deletedRows++;
    }
  }

  // リナンバリングはしない（欠番OK、JSONファイル名との整合性を維持）

  Logger.log('削除完了: スプレッドシート ' + deletedRows + '行, JSONファイル ' + deletedFiles + '件');
  return {
    deletedRows: deletedRows,
    deletedFiles: deletedFiles,
    message: 'スプレッドシート ' + deletedRows + '行, JSONファイル ' + deletedFiles + '件を削除しました。'
  };
}

/**
 * スプレッドシートのNo.・ID・医療機関・元PDFファイル名の一覧を取得
 */
function getNoList() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const noCol = headers.indexOf('No.');
  const idCol = headers.indexOf('2. ID番号');
  const hospitalCol = headers.indexOf('1. 受診中の歯科医院を選んでください。');
  const pdfCol = headers.indexOf('元PDFファイル名');
  const tsCol = headers.indexOf('タイムスタンプ');

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const list = [];

  for (let i = 0; i < data.length; i++) {
    const no = noCol >= 0 ? data[i][noCol] : '';
    if (!no) continue;  // No.がない行はスキップ

    list.push({
      no: no,
      id: idCol >= 0 ? data[i][idCol] : '',
      hospital: hospitalCol >= 0 ? data[i][hospitalCol] : '',
      pdfFilename: pdfCol >= 0 ? data[i][pdfCol] : '',
      timestamp: tsCol >= 0 ? data[i][tsCol] : '',
      row: i + 2
    });
  }

  return list;
}

/**
 * 指定No.の「元PDFファイル名」列を更新
 */
function updatePdfFilename(targetNo, pdfFilename) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const lastRow = sheet.getLastRow();

  const noCol = headers.indexOf('No.');
  const pdfCol = headers.indexOf('元PDFファイル名');

  if (noCol < 0) return { success: false, message: 'No.列が見つかりません' };
  if (pdfCol < 0) return { success: false, message: '元PDFファイル名列が見つかりません' };

  const noValues = sheet.getRange(2, noCol + 1, lastRow - 1, 1).getValues();

  for (let i = 0; i < noValues.length; i++) {
    if (Number(noValues[i][0]) === targetNo) {
      sheet.getRange(i + 2, pdfCol + 1).setValue(pdfFilename);
      Logger.log('PDF紐づけ更新: No.' + targetNo + ' → ' + pdfFilename);
      return { success: true, message: 'No.' + targetNo + ' に ' + pdfFilename + ' を紐づけました。', row: i + 2 };
    }
  }

  return { success: false, message: 'No.' + targetNo + ' が見つかりません' };
}

/**
 * ②ルート（フォーム入力+PDF紐づけ）のSourceを "GoogleForm" → "OCR" に変更
 * JSONファイル名の _Form_ → _OCR_ リネーム + JSON内のsource書き換え
 * @param {number} targetNo - 対象のNo.
 * @returns {Object} 結果
 */
function updateSourceToOCR(targetNo) {
  const folder = getOrCreateJsonFolder();
  const noStr = String(targetNo).padStart(3, '0');

  // _Form_ を含むJSONファイルを検索
  const allFiles = folder.getFiles();
  let renamedJson = false;
  let oldJsonName = '';
  let newJsonName = '';

  while (allFiles.hasNext()) {
    const file = allFiles.next();
    const name = file.getName();

    // 該当No.の _Form_ JSONファイルを探す
    if (name.startsWith(noStr + '_Form_') && name.endsWith('.json')) {
      oldJsonName = name;
      newJsonName = name.replace('_Form_', '_OCR_');

      // JSONファイル内のsourceを書き換え
      try {
        const content = file.getBlob().getDataAsString();
        const jsonData = JSON.parse(content);
        if (jsonData.metadata) {
          jsonData.metadata.source = 'OCR';
        }
        file.setContent(JSON.stringify(jsonData, null, 2));
      } catch (parseErr) {
        Logger.log('JSON内容更新エラー: ' + parseErr.toString());
      }

      // ファイル名をリネーム
      file.setName(newJsonName);
      renamedJson = true;
      Logger.log('JSONリネーム: ' + oldJsonName + ' → ' + newJsonName);
      break;
    }
  }

  return {
    success: renamedJson,
    oldJsonName: oldJsonName,
    newJsonName: newJsonName,
    message: renamedJson
      ? 'No.' + targetNo + ' のSource を OCR に変更しました。(' + oldJsonName + ' → ' + newJsonName + ')'
      : 'No.' + targetNo + ' の _Form_ JSONファイルが見つかりませんでした。'
  };
}

/**
 * 閲覧用データを取得（パスワード検証済みの場合のみ呼ばれる）
 * JSON作成済み・元PDFファイル名 列は除外して返す
 */
function getViewData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) return { headers: [], rows: [] };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // 除外する列のインデックス
  const excludeCols = [
    headers.indexOf(JSON_CREATED_COLUMN_NAME),
    headers.indexOf('元PDFファイル名'),
    headers.indexOf('メールアドレス')
  ].filter(i => i >= 0);

  // フィルタしたヘッダー
  const filteredHeaders = headers.filter((_, i) => !excludeCols.includes(i));

  // フィルタしたデータ
  const filteredRows = allData
    .filter(row => row[headers.indexOf('No.')] !== '')  // No.がない行は除外
    .map(row => {
      return row
        .filter((_, i) => !excludeCols.includes(i))
        .map(cell => {
          if (cell instanceof Date) {
            return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss');
          }
          return cell;
        });
    });

  return {
    headers: filteredHeaders,
    rows: filteredRows,
    totalCount: filteredRows.length
  };
}

/**
 * 未処理PDFの一覧を取得
 * スキャンPDFフォルダ内のPDFファイル名と、スプレッドシートの「元PDFファイル名」列を照合
 * @returns {Object} 全PDF・処理済み・未処理の一覧
 */
function getUnprocessedPdfs() {
  // 1. スキャンPDFフォルダ内の全PDFファイルを取得
  const scanFolder = DriveApp.getFolderById(SCAN_PDF_FOLDER_ID);
  const files = scanFolder.getFiles();
  const allPdfs = [];

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (name.toLowerCase().endsWith('.pdf')) {
      allPdfs.push({
        name: name,
        date: Utilities.formatDate(file.getDateCreated(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm'),
        size: Math.round(file.getSize() / 1024)  // KB
      });
    }
  }

  // 日付降順（新しい順）でソート
  allPdfs.sort(function(a, b) { return b.date.localeCompare(a.date); });

  // 2. スプレッドシートの「元PDFファイル名」列の値を取得
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const pdfCol = headers.indexOf('元PDFファイル名');
  const lastRow = sheet.getLastRow();

  const processedNames = {};
  if (pdfCol >= 0 && lastRow >= 2) {
    const pdfValues = sheet.getRange(2, pdfCol + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < pdfValues.length; i++) {
      const val = String(pdfValues[i][0]).trim();
      if (val) {
        processedNames[val] = true;
      }
    }
  }

  // 3. 照合して未処理・処理済みを分類
  const unprocessed = [];
  const processed = [];

  for (let i = 0; i < allPdfs.length; i++) {
    if (processedNames[allPdfs[i].name]) {
      processed.push(allPdfs[i]);
    } else {
      unprocessed.push(allPdfs[i]);
    }
  }

  return {
    total: allPdfs.length,
    unprocessedCount: unprocessed.length,
    processedCount: processed.length,
    unprocessed: unprocessed,
    processed: processed
  };
}
