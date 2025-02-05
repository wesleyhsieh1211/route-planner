import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardTitle, CardContent } from '/components/ui/card';
import { Button } from '/components/ui/button';
import { Upload, MapPin, Copy, Check } from 'lucide-react';

const AddressClassifier = () => {
  const [startPoint, setStartPoint] = useState('');
  const [results, setResults] = useState({
    taichungNorth: [],
    taichungSouth: [],
    generalNorth: [],
    generalSouth: [],
    southCombined: []
  });
  const [mapUrl, setMapUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 分類定義
  const northRegions = ['苗栗', '新竹', '桃園', '台北', '臺北', '新北', '基隆', '宜蘭'];
  const southRegions = ['南投', '雲林', '嘉義', '台南', '臺南', '高雄', '屏東'];
  const taichungNorthDistricts = ['北區', '西區', '北屯區', '西屯區', '中區', '東區', '清水區', '梧棲區', '大甲區', '大安區'];
  const taichungSouthDistricts = ['南區', '南屯區', '大里區', '太平區', '烏日區', '大肚區', '龍井區', '霧峰區'];

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
            generalNorth: [],
            generalSouth: [],
            southCombined: []
          };

          jsonData.forEach(row => {
            if (row['工程名稱']?.includes('安-')) return;

            const address = row['工程地址'];
            if (!address) return;

            if (address.includes('台中') || address.includes('臺中')) {
              if (taichungNorthDistricts.some(district => address.includes(district))) {
                classified.taichungNorth.push(address);
              } else if (taichungSouthDistricts.some(district => address.includes(district))) {
                classified.taichungSouth.push(address);
                classified.southCombined.push(address);
              }
            } else if (address.includes('彰化')) {
              classified.southCombined.push(address);
            } else if (northRegions.some(region => address.includes(region))) {
              classified.generalNorth.push(address);
            } else if (southRegions.some(region => address.includes(region))) {
              classified.generalSouth.push(address);
            }
          });

          setResults(classified);

          // 生成並下載分類後的 Excel
          const wb = XLSX.utils.book_new();
          Object.entries({
            '台中市北區': classified.taichungNorth,
            '台中市南區': classified.taichungSouth,
            '台中以北': classified.generalNorth,
            '台中以南': classified.generalSouth,
            '台中南區+彰化': classified.southCombined
          }).forEach(([name, addresses]) => {
            if (addresses.length > 0) {
              const ws = XLSX.utils.json_to_sheet(
                addresses.map(addr => ({ '工程地址': addr }))
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

    // 限制最多10個地址
    const limitedAddresses = addresses.slice(0, 10);
    limitedAddresses.forEach(address => {
      url += encodeURIComponent(address) + '/';
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
    <div className="p-4 max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>工程地址分類與路線規劃系統</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 起點輸入 */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="請輸入起點地址（例如：公司地址）"
                className="flex-1 p-2 border rounded"
                value={startPoint}
                onChange={(e) => setStartPoint(e.target.value)}
              />
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
                  <Button
                    onClick={copyUrl}
                    className="flex items-center gap-2"
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
                  </Button>
                </div>
              </div>
            )}

            {/* 分類結果 */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              {[
                { key: 'taichungNorth', title: '台中市北區', color: 'blue' },
                { key: 'taichungSouth', title: '台中市南區', color: 'green' },
                { key: 'generalNorth', title: '台中以北', color: 'yellow' },
                { key: 'generalSouth', title: '台中以南', color: 'pink' },
                { key: 'southCombined', title: '台中南區+彰化', color: 'purple' }
              ].map(({ key, title, color }) => (
                <div key={key} className="bg-white rounded-lg shadow">
                  <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold">
                      {title} ({results[key].length})
                    </h3>
                    <Button
                      onClick={() => generateMapUrl(results[key])}
                      disabled={results[key].length === 0}
                    >
                      產生路線網址
                    </Button>
                  </div>
                  <div className="p-4 max-h-60 overflow-auto">
                    {results[key].map((address, index) => (
                      <div key={index} className="text-sm mb-1 p-2 bg-gray-50 rounded">
                        {address}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddressClassifier;
