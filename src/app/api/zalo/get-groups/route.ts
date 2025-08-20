import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { cookie, imei, userAgent } = await request.json();

    if (!cookie || !imei || !userAgent) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc: cookie, imei, userAgent' },
        { status: 400 }
      );
    }

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

    // Lấy danh sách nhóm
    const groups = await api.getAllGroups();

    return NextResponse.json({
      success: true,
      groups: groups
    });

  } catch (error: any) {
    console.error('Get groups error:', error);
    
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
      { error: 'Failed to get groups', details: error.message },
      { status: 500 }
    );
  }
}
