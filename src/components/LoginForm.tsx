'use client';

import { useState, useEffect, useRef } from 'react';

interface LoginFormProps {
  onLogin: (data: { method: string; cookie: string; imei: string; userAgent: string; proxy?: string }) => void;
}

interface CookieData {
  cookie?: string;
  imei?: string;
  userAgent?: string;
  proxy?: string;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [cookie, setCookie] = useState('');
  const [imei, setImei] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [proxy, setProxy] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [cookieFormat, setCookieFormat] = useState<'string' | 'array' | 'unknown'>('unknown');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper function để kiểm tra và chuyển đổi cookie format
  const processCookie = (cookieInput: string) => {
    try {
      // Thử parse JSON
      const parsed = JSON.parse(cookieInput);
      if (Array.isArray(parsed)) {
        setCookieFormat('array');
        // Chuyển array thành string format
        return parsed
          .map((c: any) => `${c.name}=${c.value}`)
          .join('; ');
      }
    } catch {
      // Nếu không parse được JSON, coi như string
      setCookieFormat('string');
    }
    
    setCookieFormat('string');
    return cookieInput;
  };

  const handleCookieChange = (value: string) => {
    setCookie(value);
    if (value.trim()) {
      processCookie(value);
    } else {
      setCookieFormat('unknown');
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const cookieData: CookieData = JSON.parse(content);
        
        // Cập nhật các trường từ file JSON
        if (cookieData.cookie) {
          const processedCookie = processCookie(cookieData.cookie);
          setCookie(processedCookie);
        }
        if (cookieData.imei) setImei(cookieData.imei);
        if (cookieData.userAgent) setUserAgent(cookieData.userAgent);
        if (cookieData.proxy) setProxy(cookieData.proxy);
        
        setImportStatus({
          type: 'success',
          message: 'Import file JSON thành công!'
        });
        
        // Reset status sau 3 giây
        setTimeout(() => setImportStatus({ type: null, message: '' }), 3000);
        
      } catch (error) {
        setImportStatus({
          type: 'error',
          message: 'File JSON không hợp lệ. Vui lòng kiểm tra lại định dạng.'
        });
        
        // Reset status sau 5 giây
        setTimeout(() => setImportStatus({ type: null, message: '' }), 5000);
      }
    };
    
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Xử lý cookie trước khi gửi
      const processedCookie = processCookie(cookie);
      onLogin({ method: 'cookie', cookie: processedCookie, imei, userAgent, proxy });
    } finally {
      setIsLoading(false);
    }
  };

  const exportCookieData = () => {
    const cookieData: CookieData = {
      cookie,
      imei,
      userAgent,
      proxy: proxy || undefined
    };
    
    const dataStr = JSON.stringify(cookieData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'zalo-cookie-data.json';
    link.click();
  };

  if (!mounted) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Đăng nhập Zalo</h2>

      {/* Import/Export Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-800 mb-3">Import/Export Cookie Data</h3>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Import từ file JSON
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Chọn file JSON chứa thông tin cookie, IMEI, User Agent
            </p>
          </div>
          
          <div className="flex items-end">
            <button
              type="button"
              onClick={exportCookieData}
              disabled={!cookie || !imei || !userAgent}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Export JSON
            </button>
          </div>
        </div>

        {/* Import Status */}
        {importStatus.type && (
          <div className={`mt-3 p-3 rounded-md text-sm ${
            importStatus.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {importStatus.message}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cookie Zalo <span className="text-red-500">*</span>
          </label>
          <textarea
            value={cookie}
            onChange={(e) => handleCookieChange(e.target.value)}
            placeholder="Nhập cookie Zalo của bạn..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            required
          />
          <div className="flex items-center space-x-2 mt-1">
            <p className="text-xs text-gray-500">
              Lấy cookie từ trình duyệt khi đăng nhập Zalo
            </p>
            {cookieFormat !== 'unknown' && (
              <span className={`px-2 py-1 text-xs rounded-full ${
                cookieFormat === 'string' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {cookieFormat === 'string' ? '✅ String' : '⚠️ JSON Array'}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            IMEI <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder="Nhập IMEI của thiết bị..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            IMEI là số định danh thiết bị, cần thiết để đăng nhập
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            User Agent <span className="text-red-500">*</span>
          </label>
          <textarea
            value={userAgent}
            onChange={(e) => setUserAgent(e.target.value)}
            placeholder="Nhập User Agent của trình duyệt..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            User Agent của trình duyệt, cần thiết để đăng nhập
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proxy (tùy chọn)
          </label>
          <input
            type="text"
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="http://username:password@proxy:port"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !cookie || !imei || !userAgent}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2">Hướng dẫn lấy thông tin:</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>Cookie:</strong> F12 → Application → Cookies → Copy toàn bộ cookie Zalo</p>
          <p className="text-xs text-blue-600">
            💡 <strong>Lưu ý:</strong> Cookie phải ở dạng string, không phải JSON array. 
            Nếu copy từ DevTools, hãy copy dạng "name=value; name2=value2"
          </p>
          <p><strong>IMEI:</strong> Có thể lấy từ thiết bị hoặc sử dụng IMEI giả (ví dụ: 123456789012345)</p>
          <p><strong>User Agent:</strong> F12 → Console → navigator.userAgent</p>
          <p><strong>Import JSON:</strong> Sử dụng file JSON đã export trước đó để import nhanh</p>
        </div>
      </div>
    </div>
  );
}
