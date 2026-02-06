import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Edit3, Printer, Link, Settings, ChevronDown, Check, Plus, X, ExternalLink, Copy, CheckCircle, RefreshCw, Trash2, Pencil, Save, Loader2, AlertCircle } from 'lucide-react';

// Apps Script Web App URL
const API_URL = 'https://script.google.com/a/macros/devine.co.jp/s/AKfycbzQCrKRX7nJgryTPsP2Aceh4_Ofyef2Ez2iBmHUGBYF3K15XYZk-5Na8XDIlLCqlAGtVQ/exec';
const SurveyEditor = () => {
  // === 設定 ===
  const [formBaseUrl, setFormBaseUrl] = useState(
    'https://docs.google.com/forms/d/e/1FAIpQLSfK29rSSrvSjt7onYIO5gDCLDhtj776z-EhKfTxf2gUlGPBlQ/viewform'
  );
  const [entryId, setEntryId] = useState('482936188');
  
  // === 医療機関リスト ===
  const [hospitalList, setHospitalList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);  // フォーム同期中フラグ
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // === UI状態 ===
  const [showSettings, setShowSettings] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [customHospital, setCustomHospital] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newHospital, setNewHospital] = useState('');
  const [copied, setCopied] = useState(false);
  
  // === 編集状態 ===
  const [editingHospital, setEditingHospital] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  
  const printRef = useRef();
  const dropdownRef = useRef();
  const newHospitalInputRef = useRef(); // 追加: 入力フィールドへの参照

  // 現在の医療機関名
  const clinicName = useCustom ? customHospital : selectedHospital;

  // メッセージをクリア
  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  // 成功メッセージを表示（APIレスポンス時点で同期完了済み）
  const showSuccessWithSync = (message) => {
    // APIレスポンスが返った時点でフォーム同期は完了している
    setIsSyncing(false);
    setSuccessMessage(message + '（フォーム同期完了）');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // 成功メッセージを表示（3秒後に消える）
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // === JSONP形式でAPI呼び出し（CORS回避） ===
  const callApi = useCallback((params) => {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('リクエストがタイムアウトしました'));
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        const script = document.getElementById(callbackName);
        if (script) script.remove();
      };

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      const script = document.createElement('script');
      script.id = callbackName;
      const queryParams = new URLSearchParams({ ...params, callback: callbackName });
      script.src = `${API_URL}?${queryParams.toString()}`;
      script.onerror = () => {
        cleanup();
        reject(new Error('スクリプトの読み込みに失敗しました'));
      };
      document.body.appendChild(script);
    });
  }, []);

  // 医療機関リストを取得
  const fetchHospitalList = useCallback(async () => {
    setIsLoading(true);
    clearMessages();
    
    try {
      const result = await callApi({ action: 'getHospitalList' });
      
      if (result.success) {
        setHospitalList(result.data);
      } else {
        setError(result.error || 'データの取得に失敗しました');
      }
    } catch (err) {
      setError('サーバーに接続できません: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [callApi]);

  // 医療機関を追加
  const addHospital = async () => {
    if (!newHospital.trim()) return;

    setIsLoading(true);
    setIsSyncing(true);
    clearMessages();
    setSuccessMessage('フォームに同期中...');

    try {
      const result = await callApi({ action: 'addHospital', name: newHospital.trim() });

      if (result.success) {
        setHospitalList(result.data.list);
        setNewHospital('');
        showSuccessWithSync(`「${result.data.added}」を追加しました`);
      } else {
        setIsSyncing(false);
        setSuccessMessage(null);
        setError(result.error || '追加に失敗しました');
      }
    } catch (err) {
      setIsSyncing(false);
      setSuccessMessage(null);
      setError('サーバーに接続できません: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 追加ボタンクリック時の処理（改善版）
  const handleAddClick = () => {
    if (!newHospital.trim()) {
      // 空の場合は入力フィールドにフォーカス
      newHospitalInputRef.current?.focus();
    } else {
      // 入力済みなら追加実行
      addHospital();
    }
  };

  // 医療機関を削除
  const deleteHospital = async (name) => {
    if (!confirm(`「${name}」を削除しますか？\n\n※Googleフォームの選択肢からも削除されます`)) {
      return;
    }

    setIsLoading(true);
    setIsSyncing(true);
    clearMessages();
    setSuccessMessage('フォームに同期中...');

    try {
      const result = await callApi({ action: 'deleteHospital', name });

      if (result.success) {
        setHospitalList(result.data.list);
        if (selectedHospital === name) {
          setSelectedHospital('');
        }
        showSuccessWithSync(`「${name}」を削除しました`);
      } else {
        setIsSyncing(false);
        setSuccessMessage(null);
        setError(result.error || '削除に失敗しました');
      }
    } catch (err) {
      setIsSyncing(false);
      setSuccessMessage(null);
      setError('サーバーに接続できません: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 医療機関名を更新
  const updateHospital = async (oldName) => {
    if (!editingValue.trim() || editingValue.trim() === oldName) {
      setEditingHospital(null);
      return;
    }

    setIsLoading(true);
    setIsSyncing(true);
    clearMessages();
    setSuccessMessage('フォームに同期中...');

    try {
      const result = await callApi({ action: 'updateHospital', oldName, newName: editingValue.trim() });

      if (result.success) {
        setHospitalList(result.data.list);
        if (selectedHospital === oldName) {
          setSelectedHospital(result.data.newName);
        }
        setEditingHospital(null);
        showSuccessWithSync(`「${oldName}」→「${result.data.newName}」に更新しました`);
      } else {
        setIsSyncing(false);
        setSuccessMessage(null);
        setError(result.error || '更新に失敗しました');
      }
    } catch (err) {
      setIsSyncing(false);
      setSuccessMessage(null);
      setError('サーバーに接続できません: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 初回読み込み
  useEffect(() => {
    fetchHospitalList();
  }, [fetchHospitalList]);

  // prefill URL生成
  const prefilledFormUrl = useMemo(() => {
    if (!formBaseUrl || !clinicName) return '';

    try {
      const url = new URL(formBaseUrl);
      if (entryId) {
        url.searchParams.set('usp', 'pp_url');
        url.searchParams.set(`entry.${entryId}`, clinicName);
      }
      return url.toString();
    } catch {
      return formBaseUrl;
    }
  }, [formBaseUrl, entryId, clinicName]);

  // デバッグ用: コンソールにURLを出力
  useEffect(() => {
    if (prefilledFormUrl) {
      console.log('Generated URL:', prefilledFormUrl);
    }
  }, [prefilledFormUrl]);

  // QRコード生成
  const generateQRCode = (url, size = 150) => {
    if (!url) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
  };

  const qrCodeDisplayUrl = prefilledFormUrl || '';

  // 印刷
  const handlePrint = () => {
    window.print();
  };

  // URLコピー
  const copyUrl = async () => {
    if (prefilledFormUrl) {
      await navigator.clipboard.writeText(prefilledFormUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-10 print:pb-0 print:h-auto print:bg-white">
      <style>{`
        @media print {
          @page { 
            margin: 0; 
            size: A4; 
          }
          html, body {
            background: white !important;
          }
          .no-print { display: none !important; }
          .print-page { 
            width: 210mm;
            height: 297mm;
            padding: 10mm;
            box-sizing: border-box;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
          }
          .print-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>

      {/* === 編集パネル === */}
      <div className="no-print bg-white shadow-md sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <Edit3 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-gray-700">糖化アンケート作成ツール</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`px-4 py-2.5 rounded shadow flex items-center gap-2 font-medium transition-colors ${
                  showSettings ? 'bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                リスト追加
              </button>
              <button
                onClick={handlePrint}
                disabled={!clinicName || showSettings}
                className={`px-6 py-2.5 rounded shadow flex items-center gap-2 font-bold transition-colors ${
                  clinicName && !showSettings
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Printer className="w-4 h-4" />
                印刷 / PDF保存
              </button>
            </div>
          </div>

          {/* エラー・成功メッセージ */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {successMessage && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              isSyncing
                ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              {isSyncing ? (
                <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm">{successMessage}</span>
            </div>
          )}

          {/* QRコードプレビュー または 案内メッセージ */}
          {clinicName && qrCodeDisplayUrl ? (
            <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg border border-green-200 mb-4">
              <img 
                src={generateQRCode(qrCodeDisplayUrl, 80)} 
                alt="QR Preview" 
                className="w-16 h-16"
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-green-800 mb-1">
                  ✓ 「{clinicName}」のQRコードが生成されました
                </p>
                <ul className="text-xs text-green-700 space-y-0.5 mb-2">
                  <li className="flex"><span className="font-bold w-28 shrink-0">【印刷】</span><span>「印刷/PDF保存」ボタンでQRコード付きアンケートを印刷できます</span></li>
                  <li className="flex"><span className="font-bold w-28 shrink-0">【QRコード】</span><span>スマートフォンでQRコードをスキャンするとフォームが開きます</span></li>
                  <li className="flex"><span className="font-bold w-28 shrink-0">【フォームを開く】</span><span>下記URLをクリックするとフォームが開きます</span></li>
                </ul>
                {/* 生成URL表示 */}
                <div className="flex items-center gap-2">
                  <a
                    href={prefilledFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-w-xs px-3 py-1.5 bg-white border border-green-300 rounded text-xs text-green-700 hover:bg-green-100 hover:border-green-400 transition-colors truncate flex items-center gap-1"
                    title="クリックしてフォームを開く"
                  >
                    <Link className="w-3 h-3 shrink-0" />
                    <span className="truncate">{prefilledFormUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  <button
                    onClick={copyUrl}
                    className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                      copied 
                        ? 'bg-green-200 text-green-800' 
                        : 'bg-white border border-green-300 hover:bg-green-100 text-green-700'
                    }`}
                  >
                    {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'コピー済' : 'コピー'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 border-dashed mb-4 max-w-lg">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-blue-100 rounded-full">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-800 mb-1">
                    医療機関名を選択してください
                  </p>
                  <p className="text-xs text-blue-600 mb-2">
                    下のリストから医療機関を選ぶと、QRコード付きアンケート用紙が自動生成されます。
                    <br />
                    <span className="text-blue-500">※リストにない場合は上部の「リスト追加」ボタンから追加できます。</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-xs text-blue-500">
                    <span className="px-1.5 py-0.5 bg-white rounded border border-blue-200">① 選択またはリスト追加</span>
                    <span className="text-blue-400">→</span>
                    <span className="px-1.5 py-0.5 bg-white rounded border border-blue-200">② 印刷</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* メイン入力エリア */}
          <div className="mb-4">
            
            {/* 医療機関選択 */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-2">
                医療機関名を選択
                <button
                  onClick={fetchHospitalList}
                  disabled={isLoading}
                  className="text-blue-500 hover:text-blue-700 disabled:text-gray-300"
                  title="リストを更新"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </label>
              <div className="flex gap-2">
                {/* ドロップダウン */}
                <div className="relative w-64" ref={dropdownRef}>
                  <button
                    onClick={() => { setDropdownOpen(!dropdownOpen); setUseCustom(false); }}
                    disabled={isLoading}
                    className={`w-full px-3 py-2.5 border rounded-lg text-left flex items-center justify-between transition-colors ${
                      !useCustom && selectedHospital 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    } ${isLoading ? 'opacity-50' : ''}`}
                  >
                    <span className={selectedHospital && !useCustom ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                      {isLoading ? '読み込み中...' : (!useCustom && selectedHospital ? selectedHospital : 'リストから選択...')}
                    </span>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    ) : (
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  
                  {dropdownOpen && !isLoading && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {hospitalList.length > 0 ? (
                        hospitalList.map((name, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedHospital(name);
                              setUseCustom(false);
                              setDropdownOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-blue-50 flex items-center justify-between transition-colors"
                          >
                            <span>{name}</span>
                            {selectedHospital === name && !useCustom && (
                              <Check className="w-4 h-4 text-blue-600" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-gray-400 text-sm text-center">
                          リストが空です<br />
                          <span className="text-xs">設定から医療機関を追加してください</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 設定パネル */}
          {showSettings && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  詳細設定
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  保存
                </button>
              </div>
              
              {/* 医療機関リスト管理 - 幅を半分に */}
              <div className="max-w-md">
                <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center gap-2">
                  医療機関リスト管理（スプレッドシート連携）
                  <button
                    onClick={fetchHospitalList}
                    disabled={isLoading}
                    className="text-blue-500 hover:text-blue-700 disabled:text-gray-300 flex items-center gap-1 text-xs font-normal"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                    更新
                  </button>
                </label>
                
                {/* 追加フォーム */}
                <div className="flex gap-2 mb-3">
                  <input
                    ref={newHospitalInputRef}
                    type="text"
                    value={newHospital}
                    onChange={(e) => setNewHospital(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isLoading && newHospital.trim() && addHospital()}
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-gray-100"
                    placeholder="新しい医療機関名を入力..."
                  />
                  <button
                    onClick={handleAddClick}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1 transition-colors ${
                      isLoading
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    追加
                  </button>
                </div>
                
                {/* リスト表示 */}
                {hospitalList.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {hospitalList.map((name, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg group hover:border-gray-300 transition-colors"
                      >
                        {editingHospital === name ? (
                          <>
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') updateHospital(name);
                                if (e.key === 'Escape') setEditingHospital(null);
                              }}
                              className="flex-1 px-2 py-1 border border-blue-400 rounded outline-none text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => updateHospital(name)}
                              disabled={isLoading}
                              className="p-1 text-green-600 hover:text-green-800 disabled:text-gray-300"
                              title="保存"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingHospital(null)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="キャンセル"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm truncate">{name}</span>
                            <button
                              onClick={() => {
                                setEditingHospital(name);
                                setEditingValue(name);
                              }}
                              disabled={isLoading}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:text-gray-200"
                              title="編集"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteHospital(name)}
                              disabled={isLoading}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:text-gray-200"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic py-4 text-center">
                    {isLoading ? '読み込み中...' : '医療機関が登録されていません'}
                  </p>
                )}
                
                <p className="text-xs text-gray-400 mt-2">
                  ※ 追加・編集・削除すると、スプレッドシートとGoogleフォームの選択肢も自動更新されます
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* === プレビュー・印刷エリア === */}
      <div className="flex flex-col items-center p-4 md:p-8 print:p-0 gap-8 print:gap-0">
        
        {/* ===== 1ページ目：アンケート本体 ===== */}
        <div ref={printRef} className="print-page bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[10mm] relative text-base leading-normal box-border mx-auto print:shadow-none">
          
          {/* ヘッダー */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end mb-2 border-b-0 pb-0 w-full">
            <div></div>
            <div className="text-center px-2">
              <h1 className="text-3xl font-bold inline-block border-b-2 border-black pb-1 whitespace-nowrap">
                糖化アンケート
              </h1>
            </div>
            <div className="flex flex-col items-end text-base">
              <div className="w-full flex justify-end items-end mb-1">
                <span className="mr-2 whitespace-nowrap text-sm shrink-0 font-bold">医療機関名</span>
                <span className="text-lg border-b border-gray-500 text-center px-2 font-bold break-keep min-w-[140px]">
                  {clinicName || '（未選択）'}
                </span>
              </div>
              <div className="w-full flex justify-end items-end">
                <span className="mr-2 whitespace-nowrap text-sm shrink-0 font-bold">患者さんID:</span>
                <div className="w-40 h-6 border-b border-gray-500"></div>
              </div>
            </div>
          </div>

          {/* 基本情報入力欄 */}
          <div className="mb-3 space-y-1">
            <div className="flex items-end py-0.5">
              <span className="w-20 text-lg">質問１</span>
              <span className="mr-3 font-bold">名前（カタカナ）</span><span className="mr-3">氏</span>
              <div className="flex-1 border-b border-gray-400 mx-2 min-h-[1.5em]"></div>
              <span className="mr-3">名</span>
              <div className="flex-1 border-b border-gray-400 mx-2 min-h-[1.5em]"></div>
            </div>

            <div className="flex items-end py-0.5">
              <span className="w-20 text-lg">質問２</span>
              <span className="mr-4 font-bold">生年月日</span>
              <span className="mr-1">昭和・平成・令和</span>
              <span className="w-12 border-b border-gray-400 mx-0.5 text-center"></span>
              <span>年</span>
              <span className="w-8 border-b border-gray-400 mx-0.5 text-center"></span>
              <span>月</span>
              <span className="w-8 border-b border-gray-400 mx-0.5 text-center"></span>
              <span>日</span>
              <span className="ml-auto pl-4 flex items-center gap-1 whitespace-nowrap">
                <span>□</span>
                <span>以降、QRコードで回答</span>
              </span>
            </div>

            <div className="flex items-end py-0.5">
              <span className="w-20 text-lg">質問３</span>
              <span className="mr-4 font-bold">性別</span>
              <div className="flex gap-8">
                <label className="flex items-center gap-1"><span>□</span> 男</label>
                <label className="flex items-center gap-1"><span>□</span> 女</label>
                <label className="flex items-center gap-1"><span>□</span> 回答しない</label>
              </div>
            </div>

            <div className="flex items-end py-0.5">
              <span className="w-20 text-lg">質問４</span>
              <span className="mr-4 font-bold">血液型</span>
              <div className="flex gap-6">
                <label className="flex items-center gap-1"><span>□</span> A型</label>
                <label className="flex items-center gap-1"><span>□</span> B型</label>
                <label className="flex items-center gap-1"><span>□</span> O型</label>
                <label className="flex items-center gap-1"><span>□</span> AB型</label>
                <label className="flex items-center gap-1"><span>□</span> わからない</label>
              </div>
            </div>

            <div className="flex items-end py-0.5">
              <span className="w-20 text-lg">質問５</span>
              <span className="mr-4 font-bold">身長</span>
              <span className="w-32 border-b border-gray-400 mx-2"></span>
              <span>cm</span>
              <span className="ml-10 mr-4 font-bold">体重</span>
              <span className="w-32 border-b border-gray-400 mx-2"></span>
              <span>kg</span>
            </div>
          </div>

          {/* 中盤の質問テーブル */}
          <table className="w-full text-base mb-2 border-collapse">
            <tbody>
              <tr>
                <td className="py-1 w-20 align-top text-lg">質問６</td>
                <td className="py-1 w-28 align-top font-medium">糖尿病</td>
                <td className="py-1">
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <span>□ なし</span>
                    <span>□ 5年未満</span>
                    <span>□ 5～10年前</span>
                    <span>□ 10年以上前</span>
                    <span>□ わからない</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="py-1 align-top text-lg">質問７</td>
                <td className="py-1 align-top font-medium">脂質異常症</td>
                <td className="py-1">
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <span>□ なし</span>
                    <span>□ 5年未満</span>
                    <span>□ 5～10年前</span>
                    <span>□ 10年以上前</span>
                    <span>□ わからない</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="py-1 align-top text-lg">質問８</td>
                <td className="py-1" colSpan="2">
                  <div className="flex justify-between w-full max-w-2xl">
                    <span className="font-medium">兄弟に糖尿病歴はありますか？</span>
                    <div className="flex gap-8">
                      <span>□ はい</span>
                      <span>□ いいえ</span>
                      <span>□ わからない</span>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="py-1 align-top text-lg">質問９</td>
                <td className="py-1" colSpan="2">
                  <div className="flex justify-between w-full max-w-2xl">
                    <span className="font-medium">両親に糖尿病歴はありますか？</span>
                    <div className="flex gap-8">
                      <span>□ はい</span>
                      <span>□ いいえ</span>
                      <span>□ わからない</span>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="py-1 align-top text-lg">質問10</td>
                <td className="py-1" colSpan="2">
                  <div className="flex justify-between w-full max-w-lg">
                    <span className="font-medium">ほとんど運動しない</span>
                    <div className="flex gap-8">
                      <span>□ はい</span>
                      <span>□ いいえ</span>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="py-1 align-top text-lg">質問11</td>
                <td className="py-1" colSpan="2">
                  <div className="mb-0.5 font-medium">お菓子、スイーツなどを週何回食べますか</div>
                  <div className="flex gap-8 ml-8">
                    <span>□ ほぼ毎日</span>
                    <span>□ 週2~3回</span>
                    <span>□ 週1回以下または食べない</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 飲み物 */}
          <div className="mb-2">
            <p className="text-lg mb-0.5">質問12　最もよく飲む飲み物は何ですか？</p>
            <div className="ml-8 space-y-0.5">
              <div className="flex items-start">
                <span className="mr-2 mt-0.5">□</span>
                <div>
                  <span className="font-medium">有糖飲料</span>
                  <span className="text-gray-600 ml-1">（ジュース、炭酸飲料、スポーツドリンク、エナジードリンク、加糖コーヒーなど）</span>
                </div>
              </div>
              <div className="flex items-center">
                <span className="mr-2">□</span>
                <span className="font-medium">無糖飲料（お茶、水、炭酸水、無糖コーヒーなど）</span>
              </div>
            </div>
          </div>

          {/* アルコール */}
          <div className="mb-2">
            <p className="text-lg mb-0.5">質問13　飲酒習慣についてご質問致します。<span className="text-sm font-normal ml-2">別紙の選択肢一覧をご参照ください</span></p>
            
            <div className="ml-6">
              <div className="flex items-center mb-0.5 font-bold">
                <span className="mr-2">□</span>
                <span>飲む</span>
              </div>

              <div className="ml-6">
                <p className="mb-0.5 font-medium text-sm">どのお酒をどのくらいの量飲みますか？(複数回答可)</p>
                
                <div className="text-gray-700 mb-1 pl-3 border-l-4 border-gray-400 text-sm">
                  <div className="flex items-end">
                    <span className="font-bold mr-1">(例1)</span>
                    <span className="border-b border-gray-600 w-16 text-center mx-1">ビール</span>
                    <span>を週に</span>
                    <span className="border-b border-gray-600 w-10 text-center mx-1">2回</span>
                    <span>、</span>
                    <span className="border-b border-gray-600 w-20 text-center mx-1">350ml缶</span>
                    <span>を</span>
                    <span className="border-b border-gray-600 w-10 text-center mx-1">2</span>
                    <span>程度</span>
                  </div>
                  <div className="flex items-end">
                    <span className="font-bold mr-1">(例2)</span>
                    <span className="border-b border-gray-600 w-16 text-center mx-1">３</span>
                    <span>を週に</span>
                    <span className="border-b border-gray-600 w-10 text-center mx-1">3回</span>
                    <span>、</span>
                    <span className="border-b border-gray-600 w-20 text-center mx-1">５</span>
                    <span>を</span>
                    <span className="border-b border-gray-600 w-10 text-center mx-1">3</span>
                    <span>程度</span>
                  </div>
                </div>

                <div className="space-y-1 mt-1">
                  <div className="flex items-end">
                    <span className="font-bold w-20">回答1</span>
                    <span className="border-b border-black w-32 mx-1"></span>
                    <span>を週に</span>
                    <span className="border-b border-black w-12 mx-1"></span>
                    <span>回、</span>
                    <span className="border-b border-black w-32 mx-1"></span>
                    <span>を</span>
                    <span className="border-b border-black w-12 mx-1"></span>
                    <span>程度</span>
                  </div>
                  <div className="flex items-end">
                    <span className="font-bold w-20">回答2</span>
                    <span className="border-b border-black w-32 mx-1"></span>
                    <span>を週に</span>
                    <span className="border-b border-black w-12 mx-1"></span>
                    <span>回、</span>
                    <span className="border-b border-black w-32 mx-1"></span>
                    <span>を</span>
                    <span className="border-b border-black w-12 mx-1"></span>
                    <span>程度</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center mt-1 font-bold">
                <span className="mr-2">□</span>
                <span>ほとんど飲まない</span>
              </div>
            </div>
          </div>

          <hr className="border-t-2 border-gray-400 my-2" />

          {/* 医師入力欄 */}
          <div className="relative">
            <p className="font-bold text-lg mb-1">【医師入力欄】</p>
            <div className="flex items-center mb-1">
              <span className="w-20 text-lg">質問14</span>
              <span>歯の抜去位置を記入してください。</span>
              <div className="ml-4 flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <span>□ 右</span>
                  <span>□ 左</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>□ 上</span>
                  <span>□ 下</span>
                </div>
                <div className="w-12 h-6 border-b border-gray-500"></div>
              </div>
            </div>
            <p className="text-sm mt-2">
              その他、HbA1cなどの記入事項がございましたら、裏面をご利用ください。
            </p>

            {/* QRコード */}
            {clinicName && qrCodeDisplayUrl && (
              <div className="absolute right-0 bottom-0">
                <img 
                  src={generateQRCode(qrCodeDisplayUrl, 150)} 
                  alt="QR Code" 
                  className="w-24 h-24 object-contain"
                />
              </div>
            )}
          </div>

          <div className="text-center mt-3 text-base font-medium">
            ご協力ありがとうございました。
          </div>

        </div>

        {/* ===== 2ページ目：飲酒習慣 選択肢一覧 ===== */}
        <div className="print-page bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[10mm] relative text-base leading-normal box-border mx-auto print:shadow-none">
          
          {/* ヘッダー */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold inline-block border-b-2 border-black pb-1">
              質問13　飲酒習慣　選択肢一覧
            </h1>
          </div>

          {/* 4列の選択肢リスト */}
          <div className="flex justify-between gap-4 px-1" style={{ minHeight: '45%' }}>
            
            {/* ① お酒の種類 */}
            <div className="flex-1">
              <div className="text-sm font-bold px-2 py-2 text-center whitespace-nowrap">
                ①お酒の種類
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {[
                    { num: 1, name: 'ビール' },
                    { num: 2, name: '日本酒' },
                    { num: 3, name: '焼酎' },
                    { num: 4, name: 'チューハイ' },
                    { num: 5, name: 'ワイン' },
                    { num: 6, name: 'ウイスキー' },
                    { num: 7, name: 'ブランデー' },
                    { num: 8, name: '梅酒' },
                    { num: 9, name: '泡盛' }
                  ].map((item, idx) => (
                    <tr key={idx}>
                      <td className={`px-3 py-2 text-base border border-gray-400 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <span className="font-bold text-gray-600">{item.num}.</span>
                        <span className="ml-1">{item.name}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ② 頻度 */}
            <div className="flex-1">
              <div className="text-sm font-bold px-2 py-2 text-center whitespace-nowrap">
                ②週に何回
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {['1回', '2回', '3回', '4回', '5回', '6回', '7回（毎日）'].map((item, idx) => (
                    <tr key={idx}>
                      <td className={`px-3 py-2 text-base border border-gray-400 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        {item}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ③ サイズ・飲み方 */}
            <div className="flex-1">
              <div className="text-sm font-bold px-2 py-2 text-center whitespace-nowrap">
                ③サイズ/飲み方
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {[
                    { num: 1, name: '350ml缶' },
                    { num: 2, name: '500ml缶' },
                    { num: 3, name: '750mlビン' },
                    { num: 4, name: '375mlビン' },
                    { num: 5, name: 'コップ' },
                    { num: 6, name: '水割り' },
                    { num: 7, name: 'お湯割り' },
                    { num: 8, name: 'ロック' },
                    { num: 9, name: '小ジョッキ' },
                    { num: 10, name: '中ジョッキ' },
                    { num: 11, name: '大ジョッキ' }
                  ].map((item, idx) => (
                    <tr key={idx}>
                      <td className={`px-3 py-2 text-sm border border-gray-400 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <span className="font-bold text-gray-600">{item.num}.</span>
                        <span className="ml-1">{item.name}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ④ 数量 */}
            <div className="flex-1">
              <div className="text-sm font-bold px-2 py-2 text-center whitespace-nowrap">
                ④数量
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {['1', '2', '3', '4', '5', '6以上'].map((item, idx) => (
                    <tr key={idx}>
                      <td className={`px-3 py-2 text-base border border-gray-400 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        {item}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* フッター */}
          <div className="absolute bottom-8 left-0 right-0 text-center text-sm text-gray-500">
            - 2 / 2 -
          </div>

        </div>

      </div>
    </div>
  );
};

export default SurveyEditor;
