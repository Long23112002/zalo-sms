import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import SendLog from '@/models/SendLog';

export async function POST(request: NextRequest) {
  try {
    const { cookie, imei, userAgent, recipients, message, delay, sessionId, templateId, userId } = await request.json();

    if (!cookie || !imei || !userAgent || !recipients || !message) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc: cookie, imei, userAgent, recipients, message' },
        { status: 400 }
      );
    }

    await connectDB();

    // Sử dụng dynamic import để tránh vấn đề với sharp trên Windows
    let Zalo;
    try {
      const zcaModule = await import('zca-js');
      Zalo = zcaModule.Zalo;
    } catch (importError) {
      console.error('Failed to import zca-js:', importError);
      return NextResponse.json(
        { error: 'Không thể load thư viện Zalo. Vui lòng kiểm tra cài đặt.' },
        { status: 500 }
      );
    }

    // Tạo instance Zalo với credentials
    const zalo = new Zalo({
      cookie: cookie,
      imei: imei,
      userAgent: userAgent
    });

    // Đăng nhập
    const api = await zalo.login();

    // Bắt đầu lắng nghe sự kiện
    api.listener.start();

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Gửi tin nhắn đến từng người nhận
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        // Gửi tin nhắn (mặc định là gửi đến người dùng)
        const response = await api.sendMessage(message, recipient);
        
        results.push({
          recipient: recipient,
          success: true,
          timestamp: new Date().toISOString(),
          messageId: response.message?.msgId || null
        });
        
        // Lưu log thành công
        await SendLog.create({
          userId: userId || 'unknown',
          sessionId: sessionId || 'default',
          phone: recipient,
          uid: recipient,
          message,
          templateId,
          success: true,
          delaySeconds: delay || 0,
          sentAt: new Date()
        });

        successCount++;

        // Đợi delay giữa các tin nhắn (trừ tin nhắn cuối cùng)
        if (i < recipients.length - 1 && delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }

      } catch (error: any) {
        console.error(`Error sending message to ${recipient}:`, error);
        
        results.push({
          recipient: recipient,
          success: false,
          timestamp: new Date().toISOString(),
          error: error.message
        });
        
        await SendLog.create({
          userId: userId || 'unknown',
          sessionId: sessionId || 'default',
          phone: recipient,
          uid: recipient,
          message,
          templateId,
          success: false,
          error: error.message,
          delaySeconds: delay || 0,
          sentAt: new Date()
        });

        failureCount++;
      }
    }

    return NextResponse.json({
      success: true,
      results: results,
      successCount: successCount,
      failureCount: failureCount,
      total: recipients.length,
      countdownTotalSeconds: (delay || 0) * recipients.length
    });

  } catch (error: any) {
    console.error('Send message error:', error);
    
    // Kiểm tra nếu lỗi liên quan đến sharp
    if (error.message && error.message.includes('sharp')) {
      return NextResponse.json(
        { 
          error: 'Lỗi thư viện Sharp. Vui lòng cài đặt lại: npm install --include=optional sharp',
          details: 'Sharp module không thể load trên Windows. Hãy thử cài đặt lại.'
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Send message failed', details: error.message },
      { status: 500 }
    );
  }
}
