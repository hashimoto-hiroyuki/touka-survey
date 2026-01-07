// ========== 設定 ==========
const SPREADSHEET_ID = '1WslHkw34cxOe9YlB1owJKgnsNiV71SN_v1tO9U51GJA';
const SHEET_NAME = 'シート1';
const HOSPITAL_QUESTION_TITLE = '1. 受診中の歯科医院を選んでください。';

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
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  if (lastRow < 2) {
    return [];
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return data.map(row => row[0]).filter(name => name !== '');
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
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  // 重複チェック
  const existingList = getHospitalList();
  if (existingList.includes(name.trim())) {
    throw new Error('この医療機関名は既に存在します');
  }
  
  // 追加
  sheet.appendRow([name.trim()]);
  
  // Googleフォームも同期
  syncHospitalListOnly();
  
  return { added: name.trim(), list: getHospitalList() };
}

// ========== 医療機関を削除 ==========
function deleteHospital(name) {
  if (!name) {
    throw new Error('医療機関名が指定されていません');
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  // 該当行を探して削除
  for (let i = 2; i <= lastRow; i++) {
    const cellValue = sheet.getRange(i, 1).getValue();
    if (cellValue === name) {
      sheet.deleteRow(i);
      
      // Googleフォームも同期
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
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  // 重複チェック（自分自身以外）
  const existingList = getHospitalList();
  if (oldName !== newName.trim() && existingList.includes(newName.trim())) {
    throw new Error('この医療機関名は既に存在します');
  }
  
  // 該当行を探して更新
  for (let i = 2; i <= lastRow; i++) {
    const cellValue = sheet.getRange(i, 1).getValue();
    if (cellValue === oldName) {
      sheet.getRange(i, 1).setValue(newName.trim());
      
      // Googleフォームも同期
      syncHospitalListOnly();
      
      return { oldName: oldName, newName: newName.trim(), list: getHospitalList() };
    }
  }
  
  throw new Error('指定された医療機関名が見つかりません');
}

// ========== Googleフォームの医療機関リストを同期 ==========
function syncHospitalListOnly() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  let hList = [];
  if (lastRow >= 2) {
    hList = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => r[0]).filter(n => n !== "");
  }
  
  const form = FormApp.getActiveForm();
  
  // ページ区切りを取得
  const pageBreaks = form.getItems(FormApp.ItemType.PAGE_BREAK);
  
  // sec1(医療機関)の次にあるのが基本情報セクション（インデックス1）
  const secBasicInfo = pageBreaks[1].asPageBreakItem(); 

  const items = form.getItems(FormApp.ItemType.LIST);
  for (let i = 0; i < items.length; i++) {
    if (items[i].getTitle() === HOSPITAL_QUESTION_TITLE) {
      const q = items[i].asListItem();
      // すべての選択肢を基本情報セクションへ飛ばす
      const choices = hList.map(name => q.createChoice(name, secBasicInfo));
      q.setChoices(choices);
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
  const q1 = form.addListItem().setTitle(HOSPITAL_QUESTION_TITLE).setRequired(true);

  // セクション2: 基本情報
  const sec2 = form.addPageBreakItem().setTitle('基本情報');

  // ID番号（Q2）
  const valId = FormApp.createTextValidation()
    .requireTextMatchesPattern('^[a-zA-Z0-9]+$')
    .setHelpText('半角英数字で入力してください。')
    .build();
  const q2 = form.addTextItem().setTitle('2. ID番号').setRequired(true).setValidation(valId);

  // 名前（Q3）
  const q3 = form.addTextItem().setTitle('3. 名前').setRequired(true);
  
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

  // セクション3: 回答者種別
  const sec3 = form.addPageBreakItem().setTitle('回答者種別');
  const q8 = form.addMultipleChoiceItem().setTitle('8. あなたは患者さんですか、それとも医師ですか？').setRequired(true);

  // セクション4: 患者用情報（性別・血液型・身長・体重）
  const sec4 = form.addPageBreakItem().setTitle('患者情報');
  
  // 性別（Q9）
  const q9 = form.addMultipleChoiceItem()
    .setTitle('9. 性別')
    .setChoiceValues(['男性', '女性', 'その他', '回答しない'])
    .setRequired(true);
  
  // 血液型（Q10）★新規追加★
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

  // --- 医師用セクション ---
  const secDoctor = form.addPageBreakItem().setTitle('抜歯情報（医師用）');
  const qDoctorPos1 = form.addListItem()
    .setTitle('抜歯位置 - 部位')
    .setChoiceValues(['右上', '右下', '左上', '左下'])
    .setRequired(true);
  
  const qDoctorPos2 = form.addListItem()
    .setTitle('抜歯位置 - 歯番')
    .setChoiceValues(['1', '2', '3', '4', '5', '6', '7', '8', 'A', 'B', 'C', 'D', 'E'])
    .setRequired(true);

  // --- 4. 病院リスト取得と紐付け ---
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  let hList = [];
  if (lastRow >= 2) {
    hList = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => r[0]).filter(n => n !== "");
  }

  // 医療機関選択後は基本情報セクション(sec2)へ
  if (hList.length > 0) {
    const hChoices = hList.map(name => q1.createChoice(name, sec2));
    q1.setChoices(hChoices);
  }

  // --- 5. 条件分岐の設定 ---
  
  // 回答者種別の分岐（Q8：生年月日の後）
  q8.setChoices([
    q8.createChoice('患者', sec4),
    q8.createChoice('医師', secDoctor)
  ]);
  
  // 医師用セクションは回答後に送信
  secDoctor.setGoToPage(FormApp.PageNavigationType.SUBMIT);
  
  // 疾患ジャンプ
  q13.setChoices([q13.createChoice('はい', sec6), q13.createChoice('いいえ', sec7)]);
  q15.setChoices([q15.createChoice('はい', sec8), q15.createChoice('いいえ', sec9)]);
  q17.setChoices([q17.createChoice('はい', sec10), q17.createChoice('いいえ', sec11)]);
  q19.setChoices([q19.createChoice('はい', sec12), q19.createChoice('いいえ', sec13)]);
  
  // 期間回答後の自動進捗
  sec6.setGoToPage(sec7);
  sec8.setGoToPage(sec9);
  sec10.setGoToPage(sec11);
  sec12.setGoToPage(sec13);

  // 24. お酒を飲むかどうかの分岐
  q24.setChoices([
    q24.createChoice('はい（習慣的に飲む）', drink1.section),
    q24.createChoice('いいえ（ほとんど飲まない）', FormApp.PageNavigationType.SUBMIT)
  ]);

  // 飲酒回答後の「他にもありますか？」分岐
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

  Logger.log("再構築完了！（血液型追加版）");
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
  
  // 特に医療機関の質問のIDを確認
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
