'use client';

import { useState, useEffect } from 'react';
import AuthForm from '@/components/AuthForm';
import ZaloConfigManager from '@/components/ZaloConfigManager';
import TemplateManager from '@/components/TemplateManager';
import MessageForm from '@/components/MessageForm';
import ResultDisplay from '@/components/ResultDisplay';

interface ZaloConfig {
  _id: string;
  name: string;
  cookie: string;
  imei: string;
  userAgent: string;
  proxy?: string;
}

interface Template {
  _id: string;
  name: string;
  content: string;
  variables: string[];
}

interface UserData {
  _id: string;
  phone: string;
  xxx?: string;
  yyy?: string;
  sdt?: string;
  ttt?: string;
  zzz?: string;
  www?: string;
  uuu?: string;
  vvv?: string;
  customFields?: Record<string, string>;
}

interface MessageResult {
  phone: string;
  uid: string;
  userName: string;
  messageId: number | null;
  success: boolean;
  error?: string;
  timestamp: string;
}

export default function Home() {
  const [accessToken, setAccessToken] = useState<string>('');
  const [refreshToken, setRefreshToken] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'template' | 'message'>('config');
  const [activeZaloConfig, setActiveZaloConfig] = useState<ZaloConfig | null>(null);
  const [messageResults, setMessageResults] = useState<MessageResult[]>([]);
  const [showQRSuccess, setShowQRSuccess] = useState(false); // Thêm state để hiển thị thông báo QR success

  useEffect(() => {
    setMounted(true);
    
    // Kiểm tra token từ localStorage
    const storedAccessToken = localStorage.getItem('accessToken');
    const storedRefreshToken = localStorage.getItem('refreshToken');
    
    if (storedAccessToken && storedRefreshToken) {
      setAccessToken(storedAccessToken);
      setRefreshToken(storedRefreshToken);
    }
  }, []);

  const handleAuthSuccess = (data: { user: any; tokens: any }) => {
    setAccessToken(data.tokens.accessToken);
    setRefreshToken(data.tokens.refreshToken);
    localStorage.setItem('accessToken', data.tokens.accessToken);
    localStorage.setItem('refreshToken', data.tokens.refreshToken);
  };

  const handleLogout = () => {
    setAccessToken('');
    setRefreshToken('');
    setActiveZaloConfig(null);
    setMessageResults([]);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const handleZaloLogin = (config: ZaloConfig) => {
    setActiveZaloConfig(config);
    setActiveTab('message');
  };

  // Thêm callback để xử lý khi QR login thành công
  const handleQRLoginSuccess = async () => {
    console.log('🎉 handleQRLoginSuccess được gọi');
    console.log('🔍 Trước khi fetch config - activeZaloConfig:', activeZaloConfig);
    
    // Cần set activeZaloConfig trước khi chuyển tab
    // Lấy config mới nhất từ database hoặc tạo config tạm thời
    await fetchLatestZaloConfig();
    
    console.log('🔍 Sau khi fetch config - activeZaloConfig:', activeZaloConfig);
    
    // Sau khi đã có config, mới chuyển tab
    setActiveTab('message');
    console.log('🔄 Đã chuyển sang tab message');
    
    // Hiển thị thông báo thành công
    setShowQRSuccess(true);
    // Tự động ẩn thông báo sau 5 giây
    setTimeout(() => setShowQRSuccess(false), 5000);
    // Có thể thêm thông báo hoặc animation để user biết đã chuyển tab
    console.log('QR login thành công, đã chuyển sang tab tin nhắn');
  };

  // Thêm function để lấy config mới nhất sau khi QR login
  const fetchLatestZaloConfig = async () => {
    console.log('🔄 Bắt đầu fetchLatestZaloConfig...');
    console.log('🔑 AccessToken:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NULL');
    
    try {
      const response = await fetch('/api/zalo-config', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Data received:', data);
        console.log('🔢 Configs count:', data.configs?.length || 0);
        
        if (data.configs && data.configs.length > 0) {
          // Lấy config mới nhất (đã được sắp xếp theo createdAt desc)
          const latestConfig = data.configs[0];
          console.log('✅ Latest config found:', latestConfig.name, latestConfig._id);
          console.log('🔍 Config details:', {
            name: latestConfig.name,
            id: latestConfig._id,
            cookieType: typeof latestConfig.cookie,
            cookieLength: Array.isArray(latestConfig.cookie) ? latestConfig.cookie.length : latestConfig.cookie?.length || 0,
            imei: latestConfig.imei,
            userAgent: latestConfig.userAgent,
            isActive: latestConfig.isActive,
            createdAt: latestConfig.createdAt
          });
          
          setActiveZaloConfig(latestConfig);
          console.log('✅ Đã set active config:', latestConfig.name);
        } else {
          console.log('⚠️ Không có config nào trong database');
          console.log('💡 Cần login QR trước để tạo config');
          
          // Không tạo temp config nữa, để activeZaloConfig = null
          // User sẽ thấy thông báo yêu cầu login QR
        }
      } else {
        console.log('❌ Response not ok:', response.status, response.statusText);
        try {
          const errorData = await response.json();
          console.log('❌ Error details:', errorData);
        } catch (e) {
          console.log('❌ Không thể parse error response');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching latest config:', error);
    }
  };

  // Thêm useEffect để monitor activeZaloConfig changes
  useEffect(() => {
    console.log('🔄 activeZaloConfig changed:', activeZaloConfig);
  }, [activeZaloConfig]);

  const handleSendMessage = async (data: {
    recipients: { phone: string; message: string }[];
    delay: number;
    activeZaloConfig: ZaloConfig;
  }) => {
    const results: MessageResult[] = [];
    
    for (let i = 0; i < data.recipients.length; i++) {
      const phone = data.recipients[i].phone;
      const personalizedMessage = data.recipients[i].message;
      
      try {
        // Tìm UID của user qua số điện thoại
        const findUserResponse = await fetch('/api/zalo/find-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phoneNumber: phone,
            configId: data.activeZaloConfig._id // Sử dụng configId thay vì truyền cookie trực tiếp
          })
        });

        if (!findUserResponse.ok) {
          const errorData = await findUserResponse.json();
          results.push({
            phone,
            uid: '',
            userName: '',
            messageId: null,
            success: false,
            error: `Không tìm thấy user: ${errorData.error}`,
            timestamp: new Date().toISOString()
          });
          continue;
        }

        const userData = await findUserResponse.json();
        const uid = userData.user.uid;
        const userName = userData.user.display_name || userData.user.zalo_name || 'Unknown';

        // Gửi tin nhắn
        const sendMessageResponse = await fetch('/api/zalo/send-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: personalizedMessage,
            recipients: [uid],
            configId: data.activeZaloConfig._id, // Sử dụng configId thay vì truyền cookie trực tiếp
            delay: data.delay,
            sessionId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
            templateId: undefined,
            userId: 'me'
          })
        });

        if (sendMessageResponse.ok) {
          const messageData = await sendMessageResponse.json();
          results.push({
            phone,
            uid,
            userName,
            messageId: messageData.messageId || null,
            success: true,
            timestamp: new Date().toISOString()
          });
        } else {
          const errorData = await sendMessageResponse.json();
          results.push({
            phone,
            uid,
            userName,
            messageId: null,
            success: false,
            error: `Gửi tin nhắn thất bại: ${errorData.error}`,
            timestamp: new Date().toISOString()
          });
        }

        // Delay giữa các tin nhắn
        if (i < data.recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, data.delay * 1000));
        }
      } catch (error: any) {
        results.push({
          phone,
          uid: '',
          userName: '',
          messageId: null,
          success: false,
          error: `Lỗi xử lý: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    setMessageResults(results);
  };

  const handlePhoneClick = (phone: string, data: UserData) => {
    // Có thể mở modal preview hoặc thực hiện hành động khác
    console.log('Phone clicked:', phone, data);
  };

  if (!mounted) return null;

  if (!accessToken) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Zalo SMS</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('config')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'config'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Cấu hình Zalo
            </button>
            <button
              onClick={() => setActiveTab('template')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'template'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Template
            </button>
            <button
              onClick={() => setActiveTab('message')}
              disabled={!activeZaloConfig}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'config'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!activeZaloConfig ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Gửi tin nhắn
              {activeZaloConfig && (
                <span className="ml-2 text-xs text-blue-600">
                  ({activeZaloConfig.name})
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-8">
        {/* Success Notification Banner */}
        {showQRSuccess && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-fade-in">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    🎉 Đăng nhập QR thành công! Đã chuyển sang tab "Gửi tin nhắn"
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setShowQRSuccess(false)}
                    className="inline-flex text-green-400 hover:text-green-600 transition-colors"
                  >
                    <span className="sr-only">Đóng</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="tab-transition">
            <ZaloConfigManager
              accessToken={accessToken}
              onZaloLogin={handleZaloLogin}
              onQRLoginSuccess={handleQRLoginSuccess}
            />
          </div>
        )}
        
        {activeTab === 'template' && (
          <div className="tab-transition">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quản lý Template</h3>
                <TemplateManager accessToken={accessToken} />
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'message' && (
          <div className="tab-transition space-y-8">
            {activeZaloConfig ? (
              <>
                <MessageForm
                  onSend={async ({ recipients, delay, activeZaloConfig, sessionId, onSuccess, onFail, onDone }) => {
                    if (sessionId) {
                      try { localStorage.removeItem(`cancel:${sessionId}`); } catch {}
                    }
                    // Lặp qua recipients và gọi API theo từng người để có thể cập nhật realtime
                    for (let i = 0; i < recipients.length; i++) {
                      const phone = recipients[i].phone;
                      const personalizedMessage = recipients[i].message;
                      // check cancel trước mỗi lượt
                      if (sessionId && typeof window !== 'undefined') {
                        try {
                          if (localStorage.getItem(`cancel:${sessionId}`) === '1') {
                            onDone && onDone();
                            return;
                          }
                        } catch {}
                      }
                      try {
                        const findUserResponse = await fetch('/api/zalo/find-user', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                          },
                          body: JSON.stringify({ 
                            phoneNumber: phone, 
                            configId: activeZaloConfig._id // Sử dụng configId thay vì userId
                          })
                        });
                        if (!findUserResponse.ok) {
                          onFail && onFail(phone);
                        } else {
                          const userData = await findUserResponse.json();
                          const uid = userData.user.uid;
                          const sendMessageResponse = await fetch('/api/zalo/send-message', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${accessToken}`
                            },
                            body: JSON.stringify({ 
                              message: personalizedMessage, 
                              recipients: [uid], 
                              configId: activeZaloConfig._id, // Sử dụng configId thay vì userId
                              delay, 
                              sessionId, 
                              templateId: undefined
                            })
                          });
                          if (sendMessageResponse.ok) {
                            onSuccess && onSuccess(phone);
                          } else {
                            try {
                              const errorData = await sendMessageResponse.json();
                              const errorMessage = errorData.error || errorData.message || 'Unknown error';
                              onFail && onFail(phone, errorMessage);
                            } catch {
                              onFail && onFail(phone, 'Request failed');
                            }
                          }
                        }
                      } catch {
                        onFail && onFail(phone, 'Network error');
                      }
                      if (i < recipients.length - 1) {
                        // nếu đã bấm dừng, thoát trước khi chờ delay
                        if (sessionId && typeof window !== 'undefined') {
                          try {
                            if (localStorage.getItem(`cancel:${sessionId}`) === '1') {
                              onDone && onDone();
                              return;
                            }
                          } catch {}
                        }
                        await new Promise(r => setTimeout(r, delay * 1000));
                      }
                    }
                    if (sessionId) {
                      try { localStorage.removeItem(`cancel:${sessionId}`); } catch {}
                    }
                    onDone && onDone();
                  }}
                  onSendFriendRequest={async ({ recipients, delay, activeZaloConfig, sessionId, onSuccess, onFail, onDone }) => {
                    if (sessionId) {
                      try { localStorage.removeItem(`cancel:${sessionId}`); } catch {}
                    }
                    // Lặp qua recipients và gọi API theo từng người để có thể cập nhật realtime
                    for (let i = 0; i < recipients.length; i++) {
                      const phone = recipients[i].phone;
                      const personalizedMessage = recipients[i].message;
                      // check cancel trước mỗi lượt
                      if (sessionId && typeof window !== 'undefined') {
                        try {
                          if (localStorage.getItem(`cancel:${sessionId}`) === '1') {
                            onDone && onDone();
                            return;
                          }
                        } catch {}
                      }
                      try {
                        // Gửi lời mời kết bạn trực tiếp với phone number
                        // API sẽ tự động tìm UID và gửi lời mời
                        const sendFriendRequestResponse = await fetch('/api/zalo/send-friend-request', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ 
                            message: personalizedMessage, 
                            recipients: [phone], // Gửi phone number trực tiếp
                            configId: activeZaloConfig._id,
                            delay
                          })
                        });
                        if (sendFriendRequestResponse.ok) {
                          onSuccess && onSuccess(phone);
                        } else {
                          try {
                            const errorData = await sendFriendRequestResponse.json();
                            const errorMessage = errorData.error || errorData.message || 'Unknown error';
                            onFail && onFail(phone, errorMessage);
                          } catch {
                            onFail && onFail(phone, 'Request failed');
                          }
                        }
                      } catch {
                        onFail && onFail(phone, 'Network error');
                      }
                      if (i < recipients.length - 1) {
                        // nếu đã bấm dừng, thoát trước khi chờ delay
                        if (sessionId && typeof window !== 'undefined') {
                          try {
                            if (localStorage.getItem(`cancel:${sessionId}`) === '1') {
                              onDone && onDone();
                              return;
                            }
                          } catch {}
                        }
                        await new Promise(r => setTimeout(r, delay * 1000));
                      }
                    }
                    if (sessionId) {
                      try { localStorage.removeItem(`cancel:${sessionId}`); } catch {}
                    }
                    onDone && onDone();
                  }}
                  activeZaloConfig={activeZaloConfig}
                />
                
                {messageResults.length > 0 && (
                  <ResultDisplay results={messageResults} />
                )}
              </>
            ) : (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                  <div className="mx-auto mb-4">
                    <svg className="h-12 w-12 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-yellow-800 mb-2">Chưa có cấu hình Zalo</h3>
                  <p className="text-yellow-700 mb-4">Bạn cần đăng nhập QR trước để có thể gửi tin nhắn.</p>
                  <button
                    onClick={() => setActiveTab('config')}
                    className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Chuyển sang tab Cấu hình
                  </button>
                  <div className="mt-4 text-xs text-yellow-600">
                    Debug: activeZaloConfig = {JSON.stringify(activeZaloConfig)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
