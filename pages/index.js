import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, MapPin, Copy, Check } from 'lucide-react';

const AddressClassifier = () => {
  const [startPoint, setStartPoint] = useState('台中市西屯區中清路三段225巷12弄58號');
  const [results, setResults] = useState({
    taichungNorth: [],
    taichungSouth: [],
    southCombinedChanghua: [],
    southCombinedNantou: [],
    southCombinedAll: []
  });
  const [mapUrl, setMapUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 分類定義
  const taichungNorthDistricts = ['北區', '西區', '北屯區', '西屯區', '中區', '東區', '清水區', '梧棲區', '大甲區', '大安區', '外埔區', '后里區', '神岡區', '大雅區', '潭子區', '豐原區', '沙鹿區'];
  const taichungSouthDistricts = ['南區', '南屯區', '大里區', '太平區', '烏日區', '大肚區', '龍井區', '霧峰區', '新社區', '東勢區', '石岡區', '和平區'];

  const cleanAddress = (address) => {
    // 使用正則表達式匹配到最後一個包含「號」的完整部分
    const match = address.match(/(.*?[0-9]+[巷弄])?.*?[0-9]+號/);
    if (match) {
      return match[0];
    }
    return address;
  };

  const addToClassifiedList = (list, addressInfo) => {
    // 檢查是否已經存在相同的地址
    const isDuplicate = list.some(item => 
      item.original === addressInfo.original || 
      item.cleaned === addressInfo.cleaned
    );
    if (!isDuplicate) {
      list.push(addressInfo);
    }
  };

  const handleFileUpload = (event) => {
    try {
      setError('');
      setMapUrl('');
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (!jsonData[0] || !('工程地址' in jsonData[0])) {
            setError('找不到工程地址欄位');
            return;
          }

          const classified = {
            taichungNorth: [],
            taichungSouth: [],
            southCombinedChanghua: [],
            southCombinedNantou: [],
            southCombinedAll: []
          };

          jsonData.forEach(row => {
            // 檢查工程名稱中的關鍵字
            if (row['工程名稱']?.includes('安-') || 
                row['工程名稱']?.includes('安+') || 
                row['工程名稱']?.includes('士榮')) return;
            
            // 檢查備註欄位中的關鍵字
            if (row['備註']?.includes('皓') || 
                row['備註']?.includes('義')) return;

            const originalAddress = row['工程地址'];
            if (!originalAddress) return;

            const cleanedAddress = cleanAddress(originalAddress);
            const addressInfo = { original: originalAddress, cleaned: cleanedAddress };

            if (originalAddress.includes('台中') || originalAddress.includes('臺中')) {
              if (taichungNorthDistricts.some(district => originalAddress.includes(district))) {
                addToClassifiedList(classified.taichungNorth, addressInfo);
              } else if (taichungSouthDistricts.some(district => originalAddress.includes(district))) {
                addToClassifiedList(classified.taichungSouth, addressInfo);
                addToClassifiedList(classified.southCombinedChanghua, addressInfo);
                addToClassifiedList(classified.southCombinedNantou, addressInfo);
                addToClassifiedList(classified.southCombinedAll, addressInfo);
              }
            } else if (originalAddress.includes('彰化')) {
              addToClassifiedList(classified.southCombinedChanghua, addressInfo);
              addToClassifiedList(classified.southCombinedAll, addressInfo);
            } else if (originalAddress.includes('南投')) {
              addToClassifiedList(classified.southCombinedNantou, addressInfo);
              addToClassifiedList(classified.southCombinedAll, addressInfo);
            }
          });

          setResults(classified);

          // 生成並下載分類後的 Excel
          const wb = XLSX.utils.book_new();
          Object.entries({
            '台中市北區': classified.taichungNorth,
            '台中市南區': classified.taichungSouth,
            '台中南區+彰化': classified.southCombinedChanghua,
            '台中南區+南投': classified.southCombinedNantou,
            '台中南區+彰化+南投': classified.southCombinedAll
          }).forEach(([name, addresses]) => {
            if (addresses.length > 0) {
              const ws = XLSX.utils.json_to_sheet(
                addresses.map(addr => ({ 
                  '原始地址': addr.original,
                  '整理後地址': addr.cleaned
                }))
              );
              XLSX.utils.book_append_sheet(wb, ws, name);
            }
          });
          XLSX.writeFile(wb, '地址分類結果.xlsx');

        } catch (err) {
          setError('處理檔案時發生錯誤: ' + err.message);
        }
      };

      reader.onerror = () => {
        setError('讀取檔案時發生錯誤');
      };

      reader.readAsArrayBuffer(file);

    } catch (err) {
      setError('上傳檔案時發生錯誤: ' + err.message);
    }
  };

  const generateMapUrl = (addresses) => {
    if (!addresses || addresses.length === 0) {
      setError('沒有可規劃的地址');
      return;
    }

    let url = 'https://www.google.com/maps/dir/';
    
    if (startPoint) {
      url += encodeURIComponent(startPoint) + '/';
    }

    // 使用整理後的地址（cleaned）來產生路線
    const limitedAddresses = addresses.slice(0, 10);
    limitedAddresses.forEach(addressInfo => {
      url += encodeURIComponent(addressInfo.cleaned) + '/';
    });

    setMapUrl(url);

    if (addresses.length > 10) {
      setError('注意：由於 Google Maps 限制，只能顯示前 10 個地點');
    }
  };

  const copyUrl = () => {
    if (!mapUrl) return;
    
    try {
      const textArea = document.createElement('textarea');
      textArea.value = mapUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('複製失敗，請手動複製網址');
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto bg-sky-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 240 120" className="w-24 h-12">
              <g transform="translate(20, 25)">
                {/* Logo symbol */}
                <g transform="scale(0.8)">
                  {/* Left stripe */}
                  <rect x="0" y="0" width="15" height="70" transform="skew(-25)" fill="#333333"/>
                  {/* Middle stripe */}
                  <rect x="25" y="0" width="15" height="70" transform="skew(-25)" fill="#7FB9BD"/>
                  {/* Right stripe */}
                  <rect x="50" y="0" width="15" height="70" transform="skew(-25)" fill="#333333"/>
                </g>
                {/* IMAY text */}
                <text x="85" y="45" fontSize="36" fontFamily="Arial" fontWeight="bold" fill="#333333">IMAY</text>
              </g>
            </svg>
            <h1 className="text-2xl font-bold mb-0">艾美建材路線規劃系統</h1>
          </div>
        </div>
        <div className="space-y-4">
          {/* 起點輸入 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="請輸入起點地址"
                className="flex-1 p-2 border rounded"
                value={startPoint}
                onChange={(e) => setStartPoint(e.target.value)}
              />
              <button
                onClick={() => setStartPoint('台中市西屯區中清路三段225巷12弄58號')}
                className="px-4 py-2 bg-pink-300 text-white rounded hover:bg-pink-400"
              >
                使用公司地址
              </button>
            </div>
            <MapPin className="text-gray-400" />
          </div>

          {/* 檔案上傳 */}
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">點擊上傳</span> 或拖放檔案
                </p>
                <p className="text-xs text-gray-500">Excel 檔案 (XLSX)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* 錯誤訊息 */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* 地圖連結 */}
          {mapUrl && (
            <div className="bg-gray-50 p-4 rounded border">
              <div className="font-semibold mb-2">路線規劃連結：</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mapUrl}
                  readOnly
                  className="flex-1 p-2 border rounded bg-white"
                  onClick={(e) => e.target.select()}
                />
                <button
                  onClick={copyUrl}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      已複製
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      複製網址
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 分類結果 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'taichungNorth', title: '台中市北區' },
              { key: 'taichungSouth', title: '台中市南區' },
              { key: 'southCombinedChanghua', title: '台中南區+彰化' },
              { key: 'southCombinedNantou', title: '台中南區+南投' },
              { key: 'southCombinedAll', title: '台中南區+彰化+南投' }
            ].map(({ key, title }) => (
              <div key={key} className="bg-white rounded-lg shadow border">
                <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="text-lg font-semibold">
                    {title} ({results[key]?.length || 0})
                  </h3>
                  <button
                    onClick={() => generateMapUrl(results[key])}
                    disabled={!results[key] || results[key].length === 0}
                    className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    產生路線網址
                  </button>
                </div>
                <div className="p-4 max-h-60 overflow-auto">
                  {results[key]?.map((addressInfo, index) => (
                    <div key={index} className="text-sm mb-1 p-2 bg-gray-50 rounded">
                      <div className="text-gray-600">原始：{addressInfo.original}</div>
                      <div className="font-medium">整理：{addressInfo.cleaned}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddressClassifier;