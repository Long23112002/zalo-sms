import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { method, cookie, imei, userAgent, proxy } = await request.json();
    
    if (method !== 'cookie') {
      return NextResponse.json({ 
        error: 'Chỉ hỗ trợ đăng nhập bằng Cookie. Vui lòng chọn phương thức Cookie.' 
      }, { status: 400 });
    }

    if (!cookie || !imei || !userAgent) {
      return NextResponse.json(
        { error: 'Cookie, IMEI và User Agent là bắt buộc khi đăng nhập bằng cookie' },
        { status: 400 }
      );
    }

    // Xử lý cookie format - đảm bảo luôn nhận được string
    let cookieString = '';
    
    if (Array.isArray(cookie)) {
      // Nếu cookie là array, chuyển thành string format
      cookieString = cookie
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    } else if (typeof cookie === 'string') {
      // Nếu cookie đã là string, kiểm tra xem có phải JSON string không
      if (cookie.trim().startsWith('[')) {
        try {
          const cookieArray = JSON.parse(cookie);
          if (Array.isArray(cookieArray)) {
            cookieString = cookieArray
              .map(c => `${c.name}=${c.value}`)
              .join('; ');
          } else {
            cookieString = cookie;
          }
        } catch (parseError) {
          console.error('Error parsing cookie JSON string:', parseError);
          return NextResponse.json(
            { error: 'Cookie không đúng định dạng JSON' },
            { status: 400 }
          );
        }
      } else {
        // Cookie đã là string format đúng
        cookieString = cookie;
      }
    } else {
      return NextResponse.json(
        { error: 'Cookie không đúng định dạng. Vui lòng kiểm tra lại.' },
        { status: 400 }
      );
    }

    console.log('Processing cookie:', {
      originalType: typeof cookie,
      isArray: Array.isArray(cookie),
      cookieLength: cookieString.length,
      cookiePreview: cookieString.substring(0, 100) + '...',
      finalFormat: 'string'
    });

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
      cookie: cookieString,
      imei: imei,
      userAgent: userAgent
    });
    
    // Đăng nhập bằng cookie
    const api = await zalo.login();
    
    // Bắt đầu lắng nghe sự kiện
    api.listener.start();
    
    // Lấy thông tin tài khoản
    const accountInfo = await api.fetchAccountInfo();
    const ownId = await api.getOwnId();
    
    return NextResponse.json({
      success: true,
      accountInfo,
      ownId,
      method: 'cookie',
      cookieProcessed: true,
      cookieFormat: 'string',
      cookieLength: cookieString.length
    });
    
  } catch (error: any) {
    console.error('Login error:', error);
    
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
      { error: 'Login failed', details: error.message },
      { status: 500 }
    );
  }
}
