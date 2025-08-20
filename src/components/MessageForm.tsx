'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Select, Button, message, Table, Upload, Input, Space, Popconfirm, Modal, Typography, Divider } from 'antd';
import { Progress } from 'antd';
import { DeleteOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { RcFile } from 'antd/es/upload';
import { authFetch } from '@/utils/authFetch';

// Helper tạo session id không cần thư viện ngoài
const createSessionId = (): string => {
  try {
    // @ts-ignore
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      // @ts-ignore
      return crypto.randomUUID();
    }
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const { Option } = Select;
const { Search } = Input;

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

interface MessageFormProps {
  onSend: (data: {
    recipients: { phone: string; message: string }[];
    delay: number;
    activeZaloConfig: ZaloConfig;
    sessionId?: string;
    onSuccess?: (phone: string) => void;
    onFail?: (phone: string, error?: string) => void;
    onDone?: () => void;
  }) => void;
  onSendFriendRequest?: (data: {
    recipients: { phone: string; message: string }[];
    delay: number;
    activeZaloConfig: ZaloConfig;
    sessionId?: string;
    onSuccess?: (phone: string) => void;
    onFail?: (phone: string, error?: string) => void;
    onDone?: () => void;
  }) => void;
  activeZaloConfig: ZaloConfig | null;
}

export default function MessageForm({ onSend, onSendFriendRequest, activeZaloConfig }: MessageFormProps) {
  const [messageText, setMessageText] = useState('');
  const [delay, setDelay] = useState<string>('25');
  const [mounted, setMounted] = useState(false);
  
  // Template states
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  
  // UserData states
  const [userDataList, setUserDataList] = useState<UserData[]>([]);
  const [selectedUserData, setSelectedUserData] = useState<string>('');
  
  // Selection for table
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Friend request table states
  const [friendRequestList, setFriendRequestList] = useState<UserData[]>([]);
  const [selectedFriendRequestKeys, setSelectedFriendRequestKeys] = useState<React.Key[]>([]);

  // Filters
  const [filterQuery, setFilterQuery] = useState('');

  const filteredData = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return userDataList;
    return userDataList.filter(row => {
      const name = String(row.xxx || '').toLowerCase();
      const phone = String(row.sdt || row.phone || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [userDataList, filterQuery]);

  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');

  // Preview modal states
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewPhone, setPreviewPhone] = useState('');
  const [previewTemplateId, setPreviewTemplateId] = useState<string>('');
  const [previewText, setPreviewText] = useState('');
  const [previewRow, setPreviewRow] = useState<UserData | null>(null);

  const [msgApi, contextHolder] = message.useMessage();

  // Progress modal
  const [progressVisible, setProgressVisible] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string>('');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [sendPhase, setSendPhase] = useState<'idle' | 'pre' | 'sending'>('idle');
  const [sendMode, setSendMode] = useState<'message' | 'friendRequest'>('message');
  const [preparedRecipients, setPreparedRecipients] = useState<{ phone: string; message: string }[]>([]);
  const [preparedDelay, setPreparedDelay] = useState<number>(25);
  const [totalCountdown, setTotalCountdown] = useState<number>(0);

  useEffect(() => {
    // Clear interval cũ nếu có
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    // Chỉ tạo interval mới khi progressVisible = true và đang ở phase pre
    if (progressVisible && sendPhase === 'pre' && countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 0) {
            // Clear interval khi countdown = 0
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    
    // Cleanup function
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [progressVisible, sendPhase, countdown]);

  // Gửi tuần tự theo delay config khi countdown đạt đến thời điểm gửi
  useEffect(() => {
    if (progressVisible && sendPhase === 'pre' && countdown >= 0) {
      // Tính toán thời điểm gửi cho từng người
      const totalTime = preparedRecipients.length * preparedDelay;
      const currentTime = totalTime - countdown;
      
      // Debug log để xem giá trị
      console.log(`Debug: countdown=${countdown}, totalTime=${totalTime}, currentTime=${currentTime}, preparedDelay=${preparedDelay}, preparedRecipients.length=${preparedRecipients.length}`);
      console.log(`Debug: preparedRecipients=`, preparedRecipients);
      
      // Kiểm tra xem có phải thời điểm gửi người tiếp theo không
      // Gửi người đầu tiên sau delay đầu tiên, người thứ 2 sau delay thứ 2, v.v.
      // Cần gửi người cuối cùng khi countdown = 0
      const shouldSendNow = (currentTime > 0 && currentTime % preparedDelay === 0) || countdown === 0;
      
      console.log(`Debug: shouldSendNow=${shouldSendNow}, currentTime > 0=${currentTime > 0}, currentTime % preparedDelay=${currentTime % preparedDelay}`);
      
      if (shouldSendNow) {
        console.log(`Sending at countdown ${countdown}, current time: ${currentTime}`);
        
        // Tính toán người cần gửi (dựa trên thời gian đã trôi qua)
        let personIndex;
        if (countdown === 0) {
          // Khi countdown = 0, gửi người cuối cùng
          // Với 2 người: index 0 và 1, người cuối là index 1
          personIndex = preparedRecipients.length - 1;
        } else {
          // Tính toán bình thường
          // Với currentTime = 10, delay = 10: personIndex = Math.floor(10/10) = 1
          // Nhưng cần gửi người đầu tiên trước, nên phải trừ 1
          personIndex = Math.floor(currentTime / preparedDelay) - 1;
        }
        console.log(`Debug: personIndex=${personIndex}, countdown=${countdown}, currentRecipient=${JSON.stringify(preparedRecipients[personIndex])}`);
        if (personIndex >= 0 && personIndex < preparedRecipients.length) {
          const currentRecipient = preparedRecipients[personIndex];
          
          if (sendMode === 'message') {
            onSend({
              recipients: [currentRecipient], // Chỉ gửi 1 người hiện tại
              delay: 0, // Không delay thêm
              activeZaloConfig: activeZaloConfig!,
              sessionId,
              onSuccess: async (phone) => {
                try {
                  // Xóa dữ liệu người dùng khỏi database khi gửi tin nhắn thành công
                  const response = await authFetch(`/api/user-data?phone=${encodeURIComponent(phone)}&hard=true`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
                    }
                  });
                  
                  if (response.ok) {
                    // Xóa khỏi UI
                    setUserDataList((list) => {
                      const removedIds = list.filter((r) => (r.sdt || r.phone) === phone).map(r => r._id);
                      if (removedIds.length) {
                        setSelectedRowKeys((keys) => keys.filter(k => !removedIds.includes(k as string)));
                      }
                      return list.filter((r) => (r.sdt || r.phone) !== phone);
                    });
                    
                    // Hiển thị thông báo thành công
                    msgApi.success(`Đã gửi tin nhắn và xóa dữ liệu của ${phone}`);
                  } else {
                    // Nếu không xóa được database, vẫn xóa khỏi UI nhưng hiển thị cảnh báo
                    setUserDataList((list) => {
                      const removedIds = list.filter((r) => (r.sdt || r.phone) === phone).map(r => r._id);
                      if (removedIds.length) {
                        setSelectedRowKeys((keys) => keys.filter(k => !removedIds.includes(k as string)));
                      }
                      return list.filter((r) => (r.sdt || r.phone) !== phone);
                    });
                    
                    msgApi.warning(`Đã gửi tin nhắn thành công nhưng không thể xóa dữ liệu của ${phone}`);
                  }
                } catch (error) {
                  console.error('Error deleting user data:', error);
                  // Vẫn xóa khỏi UI để tránh gửi lại
                  setUserDataList((list) => {
                    const removedIds = list.filter((r) => (r.sdt || r.phone) === phone).map(r => r._id);
                    if (removedIds.length) {
                      setSelectedRowKeys((keys) => keys.filter(k => !removedIds.includes(k as string)));
                    }
                    return list.filter((r) => (r.sdt || r.phone) !== phone);
                  });
                  
                  msgApi.warning(`Đã gửi tin nhắn thành công nhưng không thể xóa dữ liệu của ${phone}`);
                }
              },
              onFail: (phone, error) => {
                // Hiển thị thông báo lỗi chi tiết
                if (error) {
                  msgApi.error(`Gửi tin nhắn thất bại cho ${phone}: ${error}`);
                } else {
                  msgApi.error(`Gửi tin nhắn thất bại cho ${phone}`);
                }
              },
              onDone: () => {
                // Không đóng modal, chỉ hoàn thành gửi người này
                console.log(`Completed sending to person ${personIndex + 1}`);
              }
            });
          } else if (sendMode === 'friendRequest' && onSendFriendRequest) {
            onSendFriendRequest({
              recipients: [currentRecipient], // Chỉ gửi 1 người hiện tại
              delay: 0, // Không delay thêm
              activeZaloConfig: activeZaloConfig!,
              sessionId,
              onSuccess: async (phone) => {
                try {
                  // Xóa dữ liệu người dùng khỏi database khi gửi lời mời kết bạn thành công
                  const response = await authFetch(`/api/user-data?phone=${encodeURIComponent(phone)}&hard=true`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
                    }
                  });
                  
                  if (response.ok) {
                    // Xóa khỏi bảng friend request UI
                    setFriendRequestList((list) => {
                      const removedIds = list.filter((r) => (r.sdt || r.phone) === phone).map(r => r._id);
                      if (removedIds.length) {
                        setSelectedFriendRequestKeys((keys) => keys.filter(k => !removedIds.includes(k as string)));
                      }
                      return list.filter((r) => (r.sdt || r.phone) !== phone);
                    });
                    
                    // Hiển thị thông báo thành công
                    msgApi.success(`Đã gửi lời mời kết bạn và xóa dữ liệu của ${phone}`);
                  } else {
                    // Nếu không xóa được database, vẫn xóa khỏi UI nhưng hiển thị cảnh báo
                    setFriendRequestList((list) => {
                      const removedIds = list.filter((r) => (r.sdt || r.phone) === phone).map(r => r._id);
                      if (removedIds.length) {
                        setSelectedFriendRequestKeys((keys) => keys.filter(k => !removedIds.includes(k as string)));
                      }
                      return list.filter((r) => (r.sdt || r.phone) !== phone);
                    });
                    
                    msgApi.warning(`Đã gửi lời mời kết bạn thành công nhưng không thể xóa dữ liệu của ${phone}`);
                  }
                } catch (error) {
                  console.error('Error deleting user data:', error);
                  // Vẫn xóa khỏi UI để tránh gửi lại
                  setFriendRequestList((list) => {
                    const removedIds = list.filter((r) => (r.sdt || r.phone) === phone).map(r => r._id);
                    if (removedIds.length) {
                      setSelectedFriendRequestKeys((keys) => keys.filter(k => !removedIds.includes(k as string)));
                    }
                    return list.filter((r) => (r.sdt || r.phone) !== phone);
                  });
                  
                  msgApi.warning(`Đã gửi lời mời kết bạn thành công nhưng không thể xóa dữ liệu của ${phone}`);
                }
              },
              onFail: (phone, error) => {
                // Hiển thị thông báo lỗi chi tiết
                if (error) {
                  msgApi.error(`Gửi lời mời kết bạn thất bại cho ${phone}: ${error}`);
                } else {
                  msgApi.error(`Gửi lời mời kết bạn thất bại cho ${phone}`);
                }
              },
              onDone: () => {
                // Không đóng modal, chỉ hoàn thành gửi người này
                console.log(`Completed sending friend request to person ${personIndex + 1}`);
              }
            });
          }
        }
      }
    }
    
    // Khi countdown về 0, đợi thêm 3 giây để đảm bảo người cuối cùng đã gửi xong
    if (progressVisible && sendPhase === 'pre' && countdown === 0) {
      setTimeout(() => {
        setProgressVisible(false);
        setSendPhase('idle');
      }, 3000);
    }
  }, [progressVisible, sendPhase, countdown, preparedRecipients, preparedDelay, onSend, onSendFriendRequest, activeZaloConfig, sendMode]);
  const handleSendSelected = () => {
    if (!activeZaloConfig) {
      msgApi.warning('Vui lòng đăng nhập Zalo trước');
      return;
    }
    const selectedRows = userDataList.filter(u => selectedRowKeys.includes(u._id));
    const selectedPhones = selectedRows.map(u => (u.sdt || u.phone)).filter(Boolean) as string[];
    if (selectedPhones.length === 0) {
      msgApi.warning('Vui lòng chọn người nhận');
      return;
    }
    if (!messageText.trim()) {
      msgApi.warning('Vui lòng nhập nội dung tin nhắn');
      return;
    }
    const delaySeconds = Number(delay) || 25;
    const newSession = createSessionId();
    setSessionId(newSession);
    const content = selectedTemplate
      ? (templates.find(t => t._id === selectedTemplate)?.content || messageText)
      : messageText;
    const recipients = selectedRows.map(r => ({
      phone: String(r.sdt || r.phone),
      message: mapContentForRow(content, r)
    }));
    setPreparedRecipients(recipients);
    setPreparedDelay(delaySeconds);
    // Pha đếm ngược trước khi gửi = tổng thời gian (số người × delay)
    setSendPhase('pre');
    const totalTime = recipients.length * delaySeconds;
    setCountdown(totalTime);
    setTotalCountdown(totalTime);
    setProgressVisible(true);
  };

  const handleStopSending = useCallback(() => {
    // Đánh dấu dừng gửi
    if (sessionId) {
      try {
        localStorage.setItem(`cancel:${sessionId}`, '1');
      } catch {}
    }
    
    // Dừng countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    // Reset các state
    setSendPhase('idle');
    setCountdown(0);
    setTotalCountdown(0);
    setProgressVisible(false);
    
    // Thông báo
    msgApi.warning('Đã dừng gửi');
    
    console.log('Stopped sending, sessionId:', sessionId);
  }, [sessionId]);

  // Xử lý việc dừng gửi khi sessionId thay đổi
  useEffect(() => {
    if (sessionId && typeof window !== 'undefined') {
      const checkCancel = () => {
        try {
          const isCancelled = localStorage.getItem(`cancel:${sessionId}`) === '1';
          if (isCancelled) {
            console.log('Session cancelled, stopping...');
            handleStopSending();
          }
        } catch {}
      };
      
      // Kiểm tra mỗi giây
      const cancelCheckInterval = setInterval(checkCancel, 1000);
      
      return () => {
        clearInterval(cancelCheckInterval);
      };
    }
  }, [sessionId, handleStopSending]);

  // Parse helpers
  const parseRowsToData = (rows: any[][]) => {
    // Không có header, map theo thứ tự cột: [xxx, yyy, sdt, ttt, zzz, www, uuu, vvv]
    // Hàng rỗng sẽ bị bỏ qua
    const mapped = rows
      .filter(r => Array.isArray(r) && r.some(cell => String(cell || '').trim().length > 0))
      .map((r) => {
        const xxx = String(r[0] ?? '').trim();
        const yyy = String(r[1] ?? '').trim();
        const sdt = String(r[2] ?? '').trim();
        const ttt = String(r[3] ?? '').trim();
        const zzz = String(r[4] ?? '').trim();
        const www = String(r[5] ?? '').trim();
        const uuu = String(r[6] ?? '').trim();
        const vvv = String(r[7] ?? '').trim();

        return {
          phone: sdt, // API yêu cầu phone là khóa chính
          xxx,
          sdt,
          yyy,
          ttt,
          zzz,
          www,
          uuu,
          vvv
        };
      });
    return mapped;
  };

  const importData = async (dataList: any[]) => {
    if (!dataList || dataList.length === 0) {
      msgApi.warning('Không có dữ liệu để import');
      return;
    }
    try {
      setIsImporting(true);
      const response = await authFetch('/api/user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        },
        body: JSON.stringify({ dataList })
      });
      const res = await response.json();
      if (response.ok) {
        msgApi.success(res.message || 'Import dữ liệu thành công');
        fetchUserData();
      } else {
        msgApi.error(res.error || 'Không thể import dữ liệu');
      }
    } catch (err) {
      msgApi.error('Lỗi kết nối server khi import');
    } finally {
      setIsImporting(false);
    }
  };

  // Delete helpers
  const deleteByIds = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    try {
      const tasks = ids.map(id => authFetch(`/api/user-data?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        }
      }));
      const responses = await Promise.all(tasks);
      const ok = responses.every(r => r.ok);
      if (ok) {
        msgApi.success(`Đã xóa ${ids.length} bản ghi`);
        setSelectedRowKeys(prev => prev.filter(k => !ids.includes(String(k))));
        await fetchUserData();
      } else {
        msgApi.error('Một số bản ghi không thể xóa');
      }
    } catch (error) {
      msgApi.error('Không thể xóa dữ liệu');
    }
  };

  const handleExcelImport = async (file: RcFile) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // header:1 để lấy dạng mảng mảng, không coi hàng đầu là header
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const dataList = parseRowsToData(rows);
      await importData(dataList);
    } catch (error) {
      msgApi.error('Không thể đọc file Excel');
    }
    return false; // chặn upload mặc định
  };

  const normalizeGoogleCsvUrl = (url: string) => {
    try {
      const u = new URL(url);
      // Nếu là link dạng edit, chuyển thành export csv
      if (u.hostname.includes('docs.google.com')) {
        const parts = u.pathname.split('/');
        const idIndex = parts.indexOf('d') + 1;
        const sheetId = parts[idIndex];
        if (sheetId) {
          return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        }
      }
      return url; // đã là link export csv
    } catch {
      return url;
    }
  };

  const handleImportFromGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      msgApi.warning('Nhập link Google Sheet trước');
      return;
    }
    try {
      setIsImporting(true);
      const csvUrl = normalizeGoogleCsvUrl(googleSheetUrl.trim());
      const res = await fetch(csvUrl);
      const csvText = await res.text();
      const wb = XLSX.read(csvText, { type: 'string' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const dataList = parseRowsToData(rows);
      await importData(dataList);
      setGoogleSheetUrl('');
    } catch (error) {
      msgApi.error('Không thể import từ Google Sheet');
    } finally {
      setIsImporting(false);
    }
  };

  // Đã loại bỏ phần test/convert cookie

  useEffect(() => {
    setMounted(true);
    fetchTemplates();
    fetchUserData();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await authFetch(`/api/template?ts=${Date.now()}` , {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        },
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      const response = await authFetch(`/api/user-data?ts=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        },
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserDataList(data.userDataList);
        setSelectedRowKeys(prev => prev.filter(k => data.userDataList.some((r: any) => r._id === k)));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      msgApi.error('Không thể tải dữ liệu');
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t._id === templateId);
    if (template) {
      setMessageText(template.content);
      
      // Khởi tạo biến với giá trị mặc định
      const initialVariables: Record<string, string> = {};
      template.variables.forEach(variable => {
        initialVariables[variable] = '';
      });
      setTemplateVariables(initialVariables);
    }
  };

  const handleUserDataSelect = (userDataId: string) => {
    setSelectedUserData(userDataId);
    const userData = userDataList.find(u => u._id === userDataId);
    if (userData && selectedTemplate) {
      const template = templates.find(t => t._id === selectedTemplate);
      if (template) {
        let content = template.content;
        
        // Thay thế các biến với giá trị từ UserData
        const variables = ['xxx', 'yyy', 'sdt', 'ttt', 'zzz', 'www', 'uuu', 'vvv'];
        variables.forEach(variable => {
          const value = userData[variable as keyof UserData] || '';
          if (typeof value === 'string') {
            const regex = new RegExp(`\\b${variable}\\b`, 'g');
            content = content.replace(regex, value);
          }
        });
        
        setMessageText(content);
      }
    }
  };

  const handleVariableChange = (variable: string, value: string) => {
    setTemplateVariables(prev => ({ ...prev, [variable]: value }));
    
    // Cập nhật message với giá trị biến mới
    let updatedMessage = messageText;
    const regex = new RegExp(`\\b${variable}\\b`, 'g');
    updatedMessage = updatedMessage.replace(regex, value);
    
    setMessageText(updatedMessage);
  };

  // Thêm data vào bảng friend request
  const addToFriendRequestList = (userData: UserData) => {
    // Kiểm tra xem đã có trong danh sách chưa
    const exists = friendRequestList.some(item => 
      (item.sdt || item.phone) === (userData.sdt || userData.phone)
    );
    
    if (!exists) {
      // Thêm vào bảng friend request
      setFriendRequestList(prev => [...prev, userData]);
      
      // Xóa khỏi bảng dữ liệu chính
      setUserDataList(prev => prev.filter(item => 
        (item.sdt || item.phone) !== (userData.sdt || userData.phone)
      ));
      
      // Xóa khỏi danh sách đã chọn nếu có
      setSelectedRowKeys(prev => prev.filter(key => {
        const item = userDataList.find(u => u._id === key);
        return item && (item.sdt || item.phone) !== (userData.sdt || userData.phone);
      }));
      
      msgApi.success(`Đã thêm ${userData.xxx || userData.sdt || userData.phone} vào danh sách gửi lời mời kết bạn và xóa khỏi bảng chính`);
    } else {
      msgApi.warning(`${userData.xxx || userData.sdt || userData.phone} đã có trong danh sách`);
    }
  };

  // Xóa data khỏi bảng friend request
  const removeFromFriendRequestList = (ids: string[]) => {
    setFriendRequestList(prev => prev.filter(item => !ids.includes(item._id)));
    setSelectedFriendRequestKeys(prev => prev.filter(k => !ids.includes(String(k))));
    msgApi.success(`Đã xóa ${ids.length} bản ghi khỏi danh sách gửi lời mời kết bạn`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeZaloConfig) {
      alert('Vui lòng đăng nhập Zalo trước');
      return;
    }

    // Nếu có chọn từ bảng thì ưu tiên danh sách đó, ngược lại dùng từ textarea
    const selectedRows = userDataList.filter(u => selectedRowKeys.includes(u._id));
    const selectedPhones = selectedRows.map(u => (u.sdt || u.phone));

    if (selectedPhones.length === 0) {
      alert('Vui lòng chọn người nhận trong bảng');
      return;
    }

    if (!messageText.trim()) {
      alert('Vui lòng nhập nội dung tin nhắn');
      return;
    }

    const delaySeconds = Number(delay) || 25;
    const content = selectedTemplate
      ? (templates.find(t => t._id === selectedTemplate)?.content || messageText)
      : messageText;
    const recipients = selectedRows.map(r => ({
      phone: String(r.sdt || r.phone),
      message: mapContentForRow(content, r)
    }));
    setPreparedRecipients(recipients);
    setPreparedDelay(delaySeconds);
    setSendPhase('pre');
    const totalTime = recipients.length * delaySeconds;
    setCountdown(totalTime);
    setTotalCountdown(totalTime);
    setProgressVisible(true);
  };

  // Bỏ toàn bộ xử lý cookie

  const mapContentForRow = (content: string, row: UserData): string => {
    let result = content;
    const vars = ['xxx', 'yyy', 'sdt', 'ttt', 'zzz', 'www', 'uuu', 'vvv'];
    vars.forEach((v) => {
      const raw = (row as any)[v] || '';
      const pattern = `(?:\\[\\s*${v}\\s*\\]|\\{\\s*${v}\\s*\\}|\\(\\s*${v}\\s*\\)|\\b${v}\\b)`;
      result = result.replace(new RegExp(pattern, 'gi'), String(raw));
      const upper = v.toUpperCase();
      const patternUpper = `(?:\\[\\s*${upper}\\s*\\]|\\{\\s*${upper}\\s*\\}|\\(\\s*${upper}\\s*\\)|\\b${upper}\\b)`;
      result = result.replace(new RegExp(patternUpper, 'g'), String(raw));
    });
    return result;
  };

  function computePreview(templateId: string, data: UserData | null): string {
    if (!templateId || !data) return '';
    const template = templates.find(t => t._id === templateId);
    if (!template) return '';
    let content = template.content;
    const vars = ['xxx', 'yyy', 'sdt', 'ttt', 'zzz', 'www', 'uuu', 'vvv'];
    vars.forEach(v => {
      const raw = (data as any)[v] || '';
      // Cho phép HOA/thường và có thể có [] {} () xung quanh
      const pattern = `(?:\\[\\s*${v}\\s*\\]|\\{\\s*${v}\\s*\\}|\\(\\s*${v}\\s*\\)|\\b${v}\\b)`;
      const regex = new RegExp(pattern, 'gi');
      content = content.replace(regex, String(raw));
      // Thêm biến viết hoa nguyên chữ (XXX/YYY/SDT...)
      const upper = v.toUpperCase();
      const patternUpper = `(?:\\[\\s*${upper}\\s*\\]|\\{\\s*${upper}\\s*\\}|\\(\\s*${upper}\\s*\\)|\\b${upper}\\b)`;
      const regexUpper = new RegExp(patternUpper, 'g');
      content = content.replace(regexUpper, String(raw));
    });
    return content;
  }

  const openPreviewForRow = (row: UserData) => {
    if (!selectedTemplate) {
      msgApi.warning('Vui lòng chọn template trước khi xem preview');
      return;
    }
    setPreviewRow(row);
    setPreviewPhone(row.sdt || row.phone || '');
    const tpl = selectedTemplate;
    setPreviewTemplateId(tpl);
    setPreviewText(computePreview(tpl, row));
    setPreviewVisible(true);
  };

  // Không cho đổi template trong modal preview

  if (!mounted) return null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {contextHolder}
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {sendMode === 'message' ? 'Gửi tin nhắn hàng loạt' : 'Gửi lời mời kết bạn hàng loạt'}
        </h1>
        <p className="text-gray-600">
          {sendMode === 'message' 
            ? 'Gửi tin nhắn đến nhiều số điện thoại cùng lúc'
            : 'Gửi lời mời kết bạn đến nhiều số điện thoại cùng lúc'
          }
          {activeZaloConfig && (
            <span className="ml-2 text-blue-600 font-medium">
              (Đang sử dụng: {activeZaloConfig.name})
            </span>
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selector */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Chọn Template</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template:
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="Chọn template để sử dụng"
                onChange={handleTemplateSelect}
                value={selectedTemplate}
              >
                {templates.map((template) => (
                  <Option key={template._id} value={template._id}>
                    {template.name}
                  </Option>
                ))}
              </Select>
            </div>

            {/* Bỏ phần chọn UserData và nhập biến thủ công theo yêu cầu */}
          </div>
        </div>

        {/* Message Content */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {sendMode === 'message' ? 'Nội dung tin nhắn' : 'Nội dung lời mời kết bạn'}
          </h2>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder={sendMode === 'message' 
              ? "Nhập nội dung tin nhắn hoặc chọn template từ trên..."
              : "Nhập nội dung lời mời kết bạn hoặc chọn template từ trên..."
            }
          />
          <div className="mt-2 text-sm text-gray-500">
            {messageText.length} ký tự
          </div>
        </div>

        {/* UserData Table for selection */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-col gap-3">
              {/* Hàng 1: Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Upload accept=".xlsx,.xls" beforeUpload={handleExcelImport} showUploadList={false}>
                  <Button type="primary" size="small" icon={<UploadOutlined />} loading={isImporting}>Import Excel</Button>
                </Upload>
                <Search
                  placeholder="Link Google Sheet (export CSV hoặc link edit)"
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  onSearch={handleImportFromGoogleSheet}
                  enterButton="Import từ Google Sheet"
                  loading={isImporting}
                  className="w-full sm:w-96"
                />
                {selectedRowKeys.length > 0 && (
                  <Popconfirm
                    title={`Xóa ${selectedRowKeys.length} bản ghi?`}
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => deleteByIds(selectedRowKeys as string[])}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>Xóa đã chọn ({selectedRowKeys.length})</Button>
                  </Popconfirm>
                )}
                {/* <Button 
                  size="small" 
                  type="default" 
                  disabled={selectedRowKeys.length === 0}
                  onClick={() => {
                    setSendMode('message');
                    handleSendSelected();
                  }}
                >
                  Gửi tin nhắn ({selectedRowKeys.length})
                </Button> */}
                {/* <Button 
                  size="small" 
                  type="primary" 
                  disabled={selectedRowKeys.length === 0}
                  onClick={() => {
                    setSendMode('friendRequest');
                    handleSendSelected();
                  }}
                >
                  Gửi lời mời kết bạn ({selectedRowKeys.length})
                </Button> */}
                <div className="flex items-center gap-2">
                  {/* <span className="text-sm text-gray-600">Delay (giây):</span> */}
                  {/* <Input
                    size="small"
                    inputMode="numeric"
                    value={delay}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      setDelay(v);
                    }}
                    style={{ width: 90 }}
                  /> */}
                </div>
                <div className="ml-auto hidden sm:block text-sm text-gray-500">
                  Đã chọn {selectedRowKeys.length}/{userDataList.length}
                </div>
              </div>

              {/* Hàng 2: Search */}
              <div className="flex items-center gap-2">
                <Search
                  placeholder="Tìm theo tên hoặc số điện thoại"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  allowClear
                  prefix={<SearchOutlined className="text-gray-400" />}
                  className="w-full sm:w-96"
                />
                <div className="sm:hidden text-sm text-gray-500">
                  Đã chọn {selectedRowKeys.length}/{userDataList.length}
                </div>
              </div>
            </div>
          </div>

          <Table
            rowKey="_id"
            dataSource={filteredData}
            size="small"
            bordered
            sticky

            pagination={{
              pageSize,
              current: currentPage,
              showSizeChanger: false,
              onChange: (page, size) => {
                setCurrentPage(page);
                if (size && size !== pageSize) setPageSize(size);
              }
            }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
              preserveSelectedRowKeys: true,
              selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_NONE,
                {
                  key: 'select-page',
                  text: 'Chọn tất cả trong trang',
                  onSelect: (changableRowKeys) => {
                    setSelectedRowKeys(changableRowKeys);
                  }
                }
              ]
            }}
            scroll={{ x: 'max-content' }}
            columns={[
              { 
                title: 'xxx', 
                dataIndex: 'xxx', 
                key: 'xxx', 
                width: 120,
                ellipsis: true,
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'yyy', 
                dataIndex: 'yyy', 
                key: 'yyy', 
                width: 120,
                ellipsis: true,
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'sdt', 
                dataIndex: 'sdt', 
                key: 'sdt', 
                width: 120,
                ellipsis: true,
                render: (text: string, record: any) => (
                  <Button 
                    type="link" 
                    style={{ padding: 0, height: 'auto' }} 
                    onClick={() => openPreviewForRow(record)}
                    className="truncate block"
                    title={text}
                  >
                    {text}
                  </Button>
                )
              },
              { 
                title: 'ttt', 
                dataIndex: 'ttt', 
                key: 'ttt', 
                width: 100,
                ellipsis: true,
                responsive: ['md'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'zzz', 
                dataIndex: 'zzz', 
                key: 'zzz', 
                width: 80,
                ellipsis: true,
                responsive: ['lg'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'www', 
                dataIndex: 'www', 
                key: 'www', 
                width: 80,
                ellipsis: true,
                responsive: ['xl'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'uuu', 
                dataIndex: 'uuu', 
                key: 'uuu', 
                width: 80,
                ellipsis: true,
                responsive: ['xl'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'vvv', 
                dataIndex: 'vvv', 
                key: 'vvv', 
                width: 80,
                ellipsis: true,
                responsive: ['xl'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              {
                title: 'Hành động',
                key: 'actions',
                fixed: 'right' as any,
                width: 160,
                render: (_: any, record: any) => (
                  <Space size="small">
                    <Button 
                      size="small" 
                      type="primary" 
                      icon={<span>+</span>}
                      onClick={() => addToFriendRequestList(record)}
                      title="Thêm vào danh sách gửi lời mời kết bạn"
                    >
                      Thêm
                    </Button>
                    <Popconfirm
                      title="Xóa bản ghi này?"
                      okText="Xóa"
                      cancelText="Hủy"
                      onConfirm={() => deleteByIds([record._id])}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
                    </Popconfirm>
                  </Space>
                )
              }
            ]}
          />

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-600">
              Đã chọn: <span className="font-medium">{selectedRowKeys.length}</span> người nhận
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Kích thước trang:</span>
              <Select 
                size="small" 
                value={pageSize} 
                onChange={(v) => { setPageSize(v); setCurrentPage(1); }} 
                style={{ width: 140 }}
              >
                <Option value={10}>10 / trang</Option>
                <Option value={20}>20 / trang</Option>
                <Option value={50}>50 / trang</Option>
                <Option value={100}>100 / trang</Option>
                <Option value={200}>200 / trang</Option>
              </Select>
            </div>
          </div>
        </div>

        {/* Friend Request Table */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Danh sách gửi lời mời kết bạn</h3>
                {selectedFriendRequestKeys.length > 0 && (
                  <Popconfirm
                    title={`Xóa ${selectedFriendRequestKeys.length} bản ghi khỏi danh sách?`}
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => removeFromFriendRequestList(selectedFriendRequestKeys as string[])}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>Xóa đã chọn ({selectedFriendRequestKeys.length})</Button>
                  </Popconfirm>
                )}
                {/* <Button 
                  size="small" 
                  type="primary" 
                  disabled={friendRequestList.length === 0}
                  onClick={() => {
                    setSendMode('friendRequest');
                    // Gửi từ danh sách friend request
                    const recipients = friendRequestList.map(r => ({
                      phone: String(r.sdt || r.phone),
                      message: mapContentForRow(messageText, r)
                    }));
                    setPreparedRecipients(recipients);
                    setPreparedDelay(Number(delay) || 25);
                    setSendPhase('pre');
                    const totalTime = recipients.length * (Number(delay) || 25);
                    setCountdown(totalTime);
                    setTotalCountdown(totalTime);
                    setProgressVisible(true);
                  }}
                >
                  Gửi lời mời kết bạn ({friendRequestList.length})
                </Button> */}
                <div className="ml-auto text-sm text-gray-500">
                  Đã chọn {selectedFriendRequestKeys.length}/{friendRequestList.length}
                </div>
              </div>
            </div>
          </div>

          <Table
            rowKey="_id"
            dataSource={friendRequestList}
            size="small"
            bordered
            sticky
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total) => `Tổng ${total} bản ghi`
            }}
            rowSelection={{
              selectedRowKeys: selectedFriendRequestKeys,
              onChange: (keys) => setSelectedFriendRequestKeys(keys),
              preserveSelectedRowKeys: true,
              selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_NONE,
                {
                  key: 'select-page',
                  text: 'Chọn tất cả trong trang',
                  onSelect: (changableRowKeys) => {
                    setSelectedFriendRequestKeys(changableRowKeys);
                  }
                }
              ]
            }}
            scroll={{ x: 'max-content' }}
            columns={[
              { 
                title: 'xxx', 
                dataIndex: 'xxx', 
                key: 'xxx', 
                width: 120,
                ellipsis: true,
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'yyy', 
                dataIndex: 'yyy', 
                key: 'yyy', 
                width: 120,
                ellipsis: true,
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'sdt', 
                dataIndex: 'sdt', 
                key: 'sdt', 
                width: 120,
                ellipsis: true,
                render: (text: string, record: any) => (
                  <Button 
                    type="link" 
                    style={{ padding: 0, height: 'auto' }} 
                    onClick={() => openPreviewForRow(record)}
                    className="truncate block"
                    title={text}
                  >
                    {text}
                  </Button>
                )
              },
              { 
                title: 'ttt', 
                dataIndex: 'ttt', 
                key: 'ttt', 
                width: 100,
                ellipsis: true,
                responsive: ['md'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'zzz', 
                dataIndex: 'zzz', 
                key: 'zzz', 
                width: 80,
                ellipsis: true,
                responsive: ['lg'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'www', 
                dataIndex: 'www', 
                key: 'www', 
                width: 80,
                ellipsis: true,
                responsive: ['xl'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'uuu', 
                dataIndex: 'uuu', 
                key: 'uuu', 
                width: 80,
                ellipsis: true,
                responsive: ['xl'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              { 
                title: 'vvv', 
                dataIndex: 'vvv', 
                key: 'vvv', 
                width: 80,
                ellipsis: true,
                responsive: ['xl'],
                render: (text: string) => (
                  <div className="truncate" title={text}>
                    {text}
                  </div>
                )
              },
              {
                title: 'Hành động',
                key: 'actions',
                fixed: 'right' as any,
                width: 110,
                render: (_: any, record: any) => (
                  <Popconfirm
                    title="Xóa khỏi danh sách gửi lời mời kết bạn?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => removeFromFriendRequestList([record._id])}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
                  </Popconfirm>
                )
              }
            ]}
          />

          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Tổng cộng: <span className="font-medium">{friendRequestList.length}</span> người nhận
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cài đặt</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delay giữa các tin nhắn (giây)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Đã loại bỏ khu vực Test Cookie Format theo yêu cầu */}

        {/* Send Button */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            type="submit"
            disabled={!activeZaloConfig || !messageText.trim() || selectedRowKeys.length === 0}
            onClick={() => setSendMode('message')}
            className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl w-full sm:w-auto"
          >
            <PaperAirplaneIcon className="h-6 w-6 mr-3" />
            Gửi tin nhắn hàng loạt
          </button>
          <button
            type="button"
            disabled={!activeZaloConfig || !messageText.trim() || friendRequestList.length === 0}
            onClick={() => {
              setSendMode('friendRequest');
              // Gửi từ bảng friend request thay vì bảng chính
              const recipients = friendRequestList.map(r => ({
                phone: String(r.sdt || r.phone),
                message: mapContentForRow(messageText, r)
              }));
              setPreparedRecipients(recipients);
              setPreparedDelay(Number(delay) || 25);
              setSendPhase('pre');
              const totalTime = recipients.length * (Number(delay) || 25);
              setCountdown(totalTime);
              setTotalCountdown(totalTime);
              setProgressVisible(true);
            }}
            className="inline-flex items-center justify-center px-8 py-4 bg-green-600 text-white text-lg font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl w-full sm:w-auto"
          >
            <svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            Gửi lời mời kết bạn hàng loạt
          </button>
        </div>
      </form>

      {/* Preview Modal for a single phone */}
      <Modal
        title={`Preview template - ${previewPhone || ''}`}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={700}
      >
        <div className="space-y-4">
          <Divider />
          <Typography.Paragraph>
            <span className="whitespace-pre-wrap">{previewText}</span>
          </Typography.Paragraph>
        </div>
      </Modal>

        {/* Progress Modal */}
        <Modal
          title={sendPhase === 'pre' 
            ? `Chuẩn bị ${sendMode === 'message' ? 'gửi tin nhắn' : 'gửi lời mời kết bạn'}`
            : `Đang ${sendMode === 'message' ? 'gửi tin nhắn' : 'gửi lời mời kết bạn'}`
          }
          open={progressVisible}
          onCancel={() => setProgressVisible(false)}
          maskClosable={false}
          closable={false}
          footer={null}
        >
          <div className="space-y-3">
            <div>Phiên: {sessionId}</div>
            <div className="flex items-center gap-4">
              <Progress
                type="circle"
                percent={totalCountdown > 0 ? Math.max(0, Math.round(((totalCountdown - countdown) / totalCountdown) * 100)) : 0}
              />
              <div className="text-sm text-gray-700">
                {sendPhase === 'pre' ? (
                  <>Bắt đầu {sendMode === 'message' ? 'gửi tin nhắn' : 'gửi lời mời kết bạn'} sau: <b>{new Date(countdown * 1000).toISOString().substring(14, 19)}</b></>
                ) : (
                  <>Đang gửi tuần tự, không còn đếm ngược</>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button danger onClick={handleStopSending}>
                Dừng {sendMode === 'message' ? 'gửi tin nhắn' : 'gửi lời mời kết bạn'}
              </Button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
