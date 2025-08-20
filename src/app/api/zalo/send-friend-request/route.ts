import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import ZaloConfig from '@/models/ZaloConfig';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { Zalo } from 'zca-js';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { message, recipients, configId, delay = 0 } = await request.json();
    
    console.log('Received request:', { message, recipients, configId, delay });
    
    if (!message || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Message và recipients là bắt buộc' },
        { status: 400 }
      );
    }
    
    if (!configId) {
      return NextResponse.json(
        { error: 'ConfigId là bắt buộc' },
        { status: 400 }
      );
    }
    
    // Lấy cấu hình Zalo (không cần userId)
    console.log('Looking for Zalo config:', { configId });
    const zaloConfig = await ZaloConfig.findOne({ 
      _id: configId, 
      isActive: true 
    });
      
      if (!zaloConfig) {
        console.log('Zalo config not found');
        return NextResponse.json(
          { error: 'Không tìm thấy cấu hình Zalo' },
          { status: 404 }
        );
      }
      
      console.log('Found Zalo config:', { 
        name: zaloConfig.name, 
        hasCookie: !!zaloConfig.cookie,
        hasUserAgent: !!zaloConfig.userAgent
      });
      
      // Khởi tạo Zalo instance với cấu hình
      console.log('🔄 Creating Zalo instance...');
      const zalo = new Zalo({} as any);
      console.log('✅ Zalo instance created successfully');
      
      // Lấy API object từ Zalo instance
      console.log('🔄 Getting API object from Zalo instance...');
      const api = await zalo.login({
        cookie: zaloConfig.cookie,
        imei: zaloConfig.imei,
        userAgent: zaloConfig.userAgent
      } as any);
      console.log('✅ API object obtained successfully');
      
      const results = [];
      
      for (let i = 0; i < recipients.length; i++) {
        const phoneNumber = recipients[i];
        
        try {
          // Tìm user để lấy UID trước
          console.log(`Finding user with phone number: ${phoneNumber}`);
          const userInfo = await (api as any).findUser(phoneNumber);
          console.log(`User info for ${phoneNumber}:`, userInfo);
          
          if (!userInfo || !userInfo.uid) {
            console.log(`User not found for phone number: ${phoneNumber}`);
            results.push({
              phoneNumber,
              uid: null,
              success: false,
              error: `Không tìm thấy user với số điện thoại: ${phoneNumber}`,
              timestamp: new Date().toISOString()
            });
            continue;
          }
          
          const uid = userInfo.uid;
          console.log(`Found UID ${uid} for phone number ${phoneNumber}`);
          
          // Gửi lời mời kết bạn sử dụng zca-js
          console.log(`Sending friend request to UID: ${uid} with message: ${message}`);
          
          // Sử dụng method sendFriendRequest của zca-js
          const result = await (api as any).sendFriendRequest(message,uid );
          console.log(`Friend request result for UID ${uid}:`, result);
          
          if (result && (result as any).success) {
            results.push({
              phoneNumber,
              uid,
              success: true,
              messageId: (result as any).messageId || (result as any).id || null,
              timestamp: new Date().toISOString()
            });
          } else {
            results.push({
              phoneNumber,
              uid,
              success: false,
              error: `Gửi lời mời thất bại: ${(result as any)?.message || (result as any)?.error || 'Unknown error'}`,
              timestamp: new Date().toISOString()
            });
          }
          
          // Delay giữa các lời mời
          if (i < recipients.length - 1 && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
          }
          
        } catch (error: any) {
          console.error(`Error processing phone number ${phoneNumber}:`, error);
          results.push({
            phoneNumber,
            uid: null,
            success: false,
            error: `Lỗi xử lý: ${error.message}`,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Kiểm tra xem có ít nhất 1 lời mời thành công không
      const successCount = results.filter(r => r.success).length;
      const overallSuccess = successCount > 0;
      
      return NextResponse.json({
        success: overallSuccess,
        message: overallSuccess 
          ? `Đã gửi thành công ${successCount}/${results.length} lời mời kết bạn`
          : `Không thể gửi lời mời kết bạn nào (${results.length} thất bại)`,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: results.length - successCount
        }
      });
      
    } catch (error: any) {
      console.error('Send friend request error:', error);
      return NextResponse.json(
        { error: 'Không thể gửi lời mời kết bạn', details: error.message },
        { status: 500 }
      );
    }
}
