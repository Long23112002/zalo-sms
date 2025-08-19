'use client';

import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface MessageResult {
  phone: string;
  uid: string | null;
  success: boolean;
  timestamp: string;
  messageId?: number | null;
  userName?: string;
  error?: string;
}

interface ResultDisplayProps {
  results: MessageResult[];
}

export default function ResultDisplay({ results }: ResultDisplayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const total = results.length;
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  const successRate = total > 0 ? (successCount / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <ClockIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>Chưa có kết quả gửi tin nhắn nào</p>
        <p className="text-sm">Hãy gửi tin nhắn để xem kết quả</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{total}</div>
          <div className="text-sm text-blue-700">Tổng số</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{successCount}</div>
          <div className="text-sm text-green-700">Thành công</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{failureCount}</div>
          <div className="text-sm text-red-700">Thất bại</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{successRate.toFixed(1)}%</div>
          <div className="text-sm text-purple-700">Tỷ lệ thành công</div>
        </div>
      </div>

      {/* Success Rate Bar */}
      <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-green-500 to-blue-500 h-full transition-all duration-500"
          style={{ width: `${successRate}%` }}
        ></div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.map((result, index) => (
          <div 
            key={index}
            className={`p-4 rounded-xl border ${
              result.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {result.success ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium text-gray-900">
                    {result.success ? 'Thành công' : 'Thất bại'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Số điện thoại:</span> {result.phone}
                  </div>
                  {result.uid && (
                    <div>
                      <span className="font-medium text-gray-700">UID:</span> {result.uid}
                    </div>
                  )}
                  {result.userName && (
                    <div>
                      <span className="font-medium text-gray-700">Tên:</span> {result.userName}
                    </div>
                  )}
                  {result.messageId && (
                    <div>
                      <span className="font-medium text-gray-700">Message ID:</span> {result.messageId}
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-gray-700">Thời gian:</span> {new Date(result.timestamp).toLocaleString('vi-VN')}
                  </div>
                </div>

                {!result.success && result.error && (
                  <div className="mt-2 p-2 bg-red-100 rounded border border-red-200">
                    <span className="text-sm text-red-700 font-medium">Lỗi:</span>
                    <span className="text-sm text-red-600 ml-2">{result.error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
