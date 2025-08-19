'use client';

import { useState, useEffect } from 'react';
import AuthForm from '@/components/AuthForm';
import ZaloConfigManager from '@/components/ZaloConfigManager';
import MessageForm from '@/components/MessageForm';
import ResultDisplay from '@/components/ResultDisplay';
import UserDataManager from '@/components/UserDataManager';

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
  const [activeTab, setActiveTab] = useState<'config' | 'message'>('config');
  const [activeZaloConfig, setActiveZaloConfig] = useState<ZaloConfig | null>(null);
  const [messageResults, setMessageResults] = useState<MessageResult[]>([]);

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
            cookie: data.activeZaloConfig.cookie,
            imei: data.activeZaloConfig.imei,
            userAgent: data.activeZaloConfig.userAgent,
            proxy: data.activeZaloConfig.proxy
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
            cookie: data.activeZaloConfig.cookie,
            imei: data.activeZaloConfig.imei,
            userAgent: data.activeZaloConfig.userAgent,
            proxy: data.activeZaloConfig.proxy,
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
              onClick={() => setActiveTab('message')}
              disabled={!activeZaloConfig}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'message'
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
        {activeTab === 'config' && (
          <ZaloConfigManager
            accessToken={accessToken}
            onZaloLogin={handleZaloLogin}
          />
        )}
        
        {activeTab === 'message' && activeZaloConfig && (
          <div className="space-y-8">
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
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phoneNumber: phone, cookie: activeZaloConfig.cookie, imei: activeZaloConfig.imei, userAgent: activeZaloConfig.userAgent, proxy: activeZaloConfig.proxy })
                    });
                    if (!findUserResponse.ok) {
                      onFail && onFail(phone);
                    } else {
                      const userData = await findUserResponse.json();
                      const uid = userData.user.uid;
                      const sendMessageResponse = await fetch('/api/zalo/send-message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: personalizedMessage, recipients: [uid], cookie: activeZaloConfig.cookie, imei: activeZaloConfig.imei, userAgent: activeZaloConfig.userAgent, proxy: activeZaloConfig.proxy, delay, sessionId, templateId: undefined, userId: 'me' })
                      });
                      if (sendMessageResponse.ok) {
                        onSuccess && onSuccess(phone);
                      } else {
                        onFail && onFail(phone);
                      }
                    }
                  } catch {
                    onFail && onFail(phone);
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
          </div>
        )}
      </main>
    </div>
  );
}
