import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import ZaloConfig from '@/models/ZaloConfig';

export async function POST(request: NextRequest) {
  try {
    const { userId, configId } = await request.json();

    if (!userId && !configId) {
      return NextResponse.json(
        { error: 'Thiếu thông tin: cần userId hoặc configId' },
        { status: 400 }
      );
    }

    // Kết nối database
    await connectDB();

    // Tìm Zalo config
    let zaloConfig;
    if (configId) {
      zaloConfig = await ZaloConfig.findById(configId);
    } else {
      zaloConfig = await ZaloConfig.findOne({ 
        userId, 
        isActive: true 
      }).sort({ createdAt: -1 }); // Lấy config mới nhất
    }

    if (!zaloConfig) {
      return NextResponse.json(
        { 
          error: 'Không tìm thấy Zalo config. Vui lòng login QR trước.',
          details: 'Chưa có cookie hoặc config đã bị vô hiệu hóa'
        },
        { status: 404 }
      );
    }

    console.log(`🔍 Sử dụng Zalo config: ${zaloConfig.name} (ID: ${zaloConfig._id})`);
    console.log(`🍪 Cookie length: ${zaloConfig.cookie?.length || 0} characters`);
    console.log(`📱 IMEI: ${zaloConfig.imei}`);
    console.log(`🌐 User Agent: ${zaloConfig.userAgent}`);

    // Sử dụng dynamic import để tránh vấn đề với sharp trên Windows
    let Zalo;
    try {
      const zcaModule = await import('zca-js-16');
      Zalo = zcaModule.Zalo;
    } catch (importError) {
      console.error('Failed to import zca-js-16:', importError);
      return NextResponse.json(
        { error: 'Không thể load thư viện Zalo. Vui lòng kiểm tra cài đặt.' },
        { status: 500 }
      );
    }

    // Tạo instance Zalo với credentials đã có
    const zalo = new Zalo({
      cookie: zaloConfig.cookie,
      imei: zaloConfig.imei,
      userAgent: zaloConfig.userAgent
    });

    console.log(`🚀 Khởi tạo Zalo instance với config có sẵn`);
    
    // Không cần gọi login() nữa vì đã có cookie valid
    const api = await zalo.login();

    // Bắt đầu lắng nghe sự kiện
    api.listener.start();

    console.log(`📡 Bắt đầu lấy danh sách bạn bè...`);
    
    // Lấy danh sách bạn bè
    const friends = await api.getAllFriends();

    console.log(`✅ Lấy danh sách bạn bè thành công: ${Array.isArray(friends) ? friends.length : 'N/A'} bạn bè`);

    return NextResponse.json({
      success: true,
      friends: friends,
      configInfo: {
        configId: zaloConfig._id,
        configName: zaloConfig.name,
        lastUsed: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Get friends error:', error);
    
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

    // Kiểm tra lỗi authentication
    if (error.message && error.message.includes('cookie') || error.message.includes('auth')) {
      return NextResponse.json(
        { 
          error: 'Cookie đã hết hạn hoặc không hợp lệ. Vui lòng login QR lại.',
          details: error.message,
          solution: 'Gọi lại API /api/zalo/login-qr để lấy cookie mới'
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to get friends', 
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
