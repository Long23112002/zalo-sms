'use client';

import { useState, useEffect, useRef } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, EyeSlashIcon, ArrowRightIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { authFetch } from '@/utils/authFetch';
import { Modal } from 'antd';

interface ZaloConfig {
  _id: string;
  name: string;
  cookie: string;
  imei: string;
  userAgent: string;
  proxy?: string;
  isActive: boolean;
  createdAt: string;
}

interface ZaloConfigManagerProps {
  accessToken: string;
  onZaloLogin: (config: ZaloConfig) => void;
  onQRLoginSuccess?: () => void; // Thêm callback để redirect khi QR login thành công
}

export default function ZaloConfigManager({ accessToken, onZaloLogin, onQRLoginSuccess }: ZaloConfigManagerProps) {
  const [configs, setConfigs] = useState<ZaloConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ZaloConfig | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loginLoading, setLoginLoading] = useState<string | null>(null); // ID của config đang login
  const [showCookie, setShowCookie] = useState<string | null>(null); // ID của config đang hiển thị cookie
  
  const [formData, setFormData] = useState({
    name: '',
    cookie: '',
    imei: '',
    userAgent: '',
    proxy: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR login UI
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<string>('');
  const qrTimer = useRef<any>(null);
  const [qrUserAgent, setQrUserAgent] = useState('');

  // Sub tabs: cấu hình | QR
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'qr'>('config');

  useEffect(() => {
    setMounted(true);
    fetchConfigs();
  }, []);

  // Utility function để xử lý cookie format
  const processCookieFormat = (cookie: any): string => {
    if (Array.isArray(cookie)) {
      // Nếu cookie là array, chuyển thành string format
      return cookie
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    } else if (typeof cookie === 'string') {
      // Nếu cookie đã là string, kiểm tra xem có phải JSON string không
      if (cookie.trim().startsWith('[')) {
        try {
          const cookieArray = JSON.parse(cookie);
          if (Array.isArray(cookieArray)) {
            return cookieArray
              .map(c => `${c.name}=${c.value}`)
              .join('; ');
          }
        } catch (parseError) {
          console.error('Error parsing cookie JSON string:', parseError);
          throw new Error('Cookie không đúng định dạng JSON');
        }
      }
      // Cookie đã là string format đúng
      return cookie;
    }
    throw new Error('Cookie không đúng định dạng');
  };

  // Helper function để hiển thị cookie đã format
  const getDisplayCookie = (cookie: string): string => {
    try {
      return processCookieFormat(cookie);
    } catch (error) {
      // Nếu format lỗi, trả về cookie gốc
      return cookie;
    }
  };

  const fetchConfigs = async () => {
    try {
      const response = await authFetch('/api/zalo-config', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };

  // Xử lý import cookie từ JSON file
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const cookieData = JSON.parse(content);
        
        // Sử dụng utility function để xử lý cookie format
        const cookieString = processCookieFormat(cookieData);
        setFormData(prev => ({ ...prev, cookie: cookieString }));
        setSuccess('Import cookie thành công!');
      } catch (error: any) {
        setError(`Lỗi import cookie: ${error.message}`);
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
    setError('');
    setSuccess('');

    try {
      // Đảm bảo cookie luôn được format trước khi gửi
      let formattedCookie = formData.cookie;
      try {
        // Kiểm tra xem cookie có phải JSON array không
        if (formData.cookie.trim().startsWith('[')) {
          const cookieArray = JSON.parse(formData.cookie);
          if (Array.isArray(cookieArray)) {
            formattedCookie = cookieArray
              .map(c => `${c.name}=${c.value}`)
              .join('; ');
          }
        }
      } catch (parseError) {
        // Nếu parse lỗi, giữ nguyên cookie gốc
        formattedCookie = formData.cookie;
      }

      const endpoint = '/api/zalo-config';
      const method = editingConfig ? 'PUT' : 'POST';
      const payload = editingConfig 
        ? { ...formData, id: editingConfig._id, cookie: formattedCookie }
        : { ...formData, cookie: formattedCookie };

      const response = await authFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message);
        setShowForm(false);
        setEditingConfig(null);
        setFormData({ name: '', cookie: '', imei: '', userAgent: '', proxy: '' });
        fetchConfigs();
      } else {
        let err = 'Có lỗi xảy ra';
        try { const d = await response.json(); err = d.error || err; } catch {}
        setError(err);
      }
    } catch (error: any) {
      setError('Không thể kết nối đến server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (config: ZaloConfig) => {
    // Tự động format cookie thành string nếu cần
    const formattedCookie = getDisplayCookie(config.cookie);

    setEditingConfig(config);
    setFormData({
      name: config.name,
      cookie: formattedCookie,
      imei: config.imei,
      userAgent: config.userAgent,
      proxy: config.proxy || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cấu hình này?')) return;

    try {
      const response = await authFetch(`/api/zalo-config?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess('Xóa cấu hình thành công');
        fetchConfigs();
      } else {
        let err = 'Không thể xóa cấu hình';
        try { const d = await response.json(); err = d.error || err; } catch {}
        setError(err);
      }
    } catch (error) {
      setError('Không thể kết nối đến server');
    }
  };

  // Xử lý login vào Zalo với config có sẵn
  const handleZaloLogin = async (config: ZaloConfig) => {
    setLoginLoading(config._id);
    setError('');
    setSuccess('');

    try {
      // Kiểm tra config có hợp lệ không
      if (!config.cookie || !config.imei || !config.userAgent) {
        setError('Config không đầy đủ thông tin (cookie, IMEI, User Agent)');
        setLoginLoading(null);
        return;
      }

      // Kiểm tra config có active không
      if (!config.isActive) {
        setError('Config này không hoạt động. Vui lòng kích hoạt trước khi sử dụng.');
        setLoginLoading(null);
        return;
      }

      // Kiểm tra cookie có dữ liệu không
      let cookieData = config.cookie;
      if (Array.isArray(cookieData) && cookieData.length === 0) {
        setError('Config này không có cookie hợp lệ. Vui lòng login QR lại.');
        setLoginLoading(null);
        return;
      }
      
      if (typeof cookieData === 'string' && cookieData.trim() === '') {
        setError('Config này không có cookie hợp lệ. Vui lòng login QR lại.');
        setLoginLoading(null);
        return;
      }

      // Xử lý cookie format để hiển thị
      let cookieDisplay: string;
      try {
        cookieDisplay = getDisplayCookie(config.cookie);
        console.log(`🍪 Cookie format cho config ${config.name}:`, cookieDisplay);
      } catch (cookieError: any) {
        console.warn(`⚠️ Cookie format warning: ${cookieError.message}`);
        cookieDisplay = 'Cookie format không chuẩn';
      }

      // Log thông tin config
      console.log(`🔍 Sử dụng config:`, {
        name: config.name,
        id: config._id,
        cookieLength: typeof config.cookie === 'string' ? config.cookie.length : 'Array/Object',
        imei: config.imei,
        userAgent: config.userAgent,
        isActive: config.isActive
      });

      // Thành công - gọi callback để chuyển sang tab gửi tin nhắn
      setSuccess(`✅ Đã chọn config "${config.name}" để sử dụng. Chuyển sang tab gửi tin nhắn...`);
      console.log(`✅ Login thành công với config: ${config.name}`);
      
      // Delay một chút để user thấy thông báo thành công
      setTimeout(() => {
        // Gọi callback để chuyển sang tab gửi tin nhắn
        onZaloLogin(config);
      }, 1000);
      
    } catch (error: any) {
      console.error(`❌ Lỗi khi login với config ${config.name}:`, error);
      setError(`Lỗi khi đăng nhập: ${error.message || 'Không xác định'}`);
    } finally {
      setLoginLoading(null);
    }
  };

  // Bắt đầu QR login
  const startQRLogin = async () => {
    setError('');
    setSuccess('');
    setQrSrc(null);
    setQrSession('');
    setQrOpen(true);
    try {
      const res = await fetch('/api/zalo/login-qr', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}` // Thêm Authorization header
        },
        body: JSON.stringify({ userAgent: qrUserAgent })
      });
      const data = await res.json();
      if (data.sessionId) {
        setQrSession(data.sessionId);
        if (data.qrBase64) setQrSrc(data.qrBase64);
        if (qrTimer.current) clearInterval(qrTimer.current);
        qrTimer.current = setInterval(async () => {
          // tải lại ảnh nếu thiếu
          if (!qrSrc && data.qrBase64) setQrSrc(data.qrBase64);
          const st = await fetch(`/api/zalo/login-qr?sessionId=${data.sessionId}`).then(r => r.json());
          if (st.done) {
            clearInterval(qrTimer.current);
            if (st.ok) {
              console.log('🎉 QR login thành công!');
              console.log('📊 Session data:', st);
              setSuccess('Đăng nhập bằng QR thành công');
              onQRLoginSuccess?.(); // Trigger redirect
            } else {
              console.log('❌ QR login thất bại:', st.error);
              setError(st.error || 'Đăng nhập QR thất bại');
            }
            setQrOpen(false);
          }
        }, 2000);
      } else {
        setError(data.error || 'Không thể khởi tạo QR');
      }
    } catch (e: any) {
      setError(e.message || 'Không thể khởi tạo QR');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingConfig(null);
    setFormData({ name: '', cookie: '', imei: '', userAgent: '', proxy: '' });
    setError('');
    setSuccess('');
  };

  // Toggle hiển thị cookie
  const toggleCookieVisibility = (configId: string) => {
    setShowCookie(showCookie === configId ? null : configId);
  };

  if (!mounted) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Quản lý cấu hình Zalo</h1>
        <p className="text-gray-600">Lưu trữ và quản lý các cấu hình đăng nhập Zalo của bạn</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={() => setActiveSubTab('config')}
          className={`px-3 py-2 rounded-lg ${activeSubTab==='config' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >Cấu hình Cookie</button>

        <button
          onClick={() => setActiveSubTab('qr')}
          className={`px-3 py-2 rounded-lg ${activeSubTab==='qr' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >Login bằng QR</button>
      </div>

      {activeSubTab === 'config' && (
        <>
          {/* Action Buttons */}
          {!showForm && (
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Thêm cấu hình mới
              </button>
            </div>
          )}
        </>
      )}

      {/* Configuration Modal */}
      <Modal
        title={editingConfig ? 'Chỉnh sửa cấu hình' : 'Thêm cấu hình mới'}
        open={showForm}
        onCancel={resetForm}
        footer={null}
        width={700}
        destroyOnClose
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tên cấu hình <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ví dụ: Tài khoản chính"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                IMEI <span className="text-red-500">*</span>
              </label>
              <input
                name="imei"
                type="text"
                required
                value={formData.imei}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập IMEI thiết bị"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Cookie <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  <DocumentArrowUpIcon className="h-3 w-3 mr-1" />
                  Import JSON
                </button>
              </div>
            </div>
            <textarea
              name="cookie"
              required
              rows={4}
              value={formData.cookie}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="Nhập cookie Zalo hoặc import từ file JSON"
            />
            <p className="text-xs text-gray-500 mt-1">
              Cookie sẽ được tự động chuyển đổi sang định dạng phù hợp khi lưu
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User Agent <span className="text-red-500">*</span>
            </label>
            <textarea
              name="userAgent"
              required
              rows={2}
              value={formData.userAgent}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nhập User Agent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proxy (tùy chọn)
            </label>
            <input
              name="proxy"
              type="text"
              value={formData.proxy}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="http://username:password@proxy:port"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Đang xử lý...' : (editingConfig ? 'Cập nhật' : 'Thêm mới')}
            </button>
          </div>
        </form>
      </Modal>

      {activeSubTab === 'config' && (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Danh sách cấu hình</h3>
        </div>

        {configs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Chưa có cấu hình nào. Hãy thêm cấu hình đầu tiên!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {configs.map((config) => (
              <div key={config._id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-900">{config.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        config.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {config.isActive ? 'Hoạt động' : 'Không hoạt động'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">IMEI:</span> {config.imei}
                      </div>
                      <div>
                        <span className="font-medium">Proxy:</span> {config.proxy || 'Không có'}
                      </div>
                      <div>
                        <span className="font-medium">Ngày tạo:</span> {new Date(config.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>

                    {/* Cookie Preview */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Cookie:</span>
                        <button
                          onClick={() => toggleCookieVisibility(config._id)}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {showCookie === config._id ? 'Ẩn' : 'Xem'}
                        </button>
                      </div>
                      {showCookie === config._id && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                          <p className="text-xs font-mono text-gray-700 break-all">
                            {getDisplayCookie(config.cookie)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {/* Login Button */}
                    <button
                      onClick={() => handleZaloLogin(config)}
                      disabled={loginLoading === config._id}
                      className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center"
                      title="Sử dụng config này để gửi tin nhắn"
                    >
                      {loginLoading === config._id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Đang xử lý...
                        </>
                      ) : (
                        <>
                          <ArrowRightIcon className="h-4 w-4 mr-1" />
                          Sử dụng
                        </>
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleEdit(config)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Chỉnh sửa"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(config._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}



      {activeSubTab === 'qr' && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Đăng nhập bằng QR</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">User Agent (tùy chọn)</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập user-agent nếu cần"
                value={qrUserAgent}
                onChange={(e) => setQrUserAgent(e.target.value)}
              />
              <div className="mt-3">
                <button
                  onClick={startQRLogin}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >Tạo mã QR</button>
              </div>
            </div>
            {/* <div className="flex items-center justify-center">
              {qrSrc ? (
                <img src={qrSrc} alt="QR" className="max-h-64 rounded-lg border" />
              ) : (
                <div className="text-gray-500">Ảnh QR sẽ hiển thị tại đây</div>
              )}
            </div> */}
          </div>
        </div>
      )}
      <Modal open={qrOpen} onCancel={() => setQrOpen(false)} footer={null} title="Đăng nhập bằng QR">
        {qrSrc ? (
          <img src={qrSrc} alt="QR" className="mx-auto rounded-lg border" />
        ) : (
          <div className="text-center text-gray-500">Đang tạo mã QR...</div>
        )}
        <div className="mt-3 text-sm text-gray-600">Session: {qrSession}</div>
      </Modal>
    </div>
  );
}
