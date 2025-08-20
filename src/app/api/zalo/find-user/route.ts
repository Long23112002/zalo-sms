import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import ZaloConfig from '@/models/ZaloConfig';

// Function để convert cookie từ database về format mà zca-js-16 cần
function convertCookieForZca(cookieFromDB: any): any {
  try {
    if (!cookieFromDB) return '';
    
    // Nếu cookie đã là array, kiểm tra format và convert nếu cần
    if (Array.isArray(cookieFromDB)) {
      console.log(`🍪 Cookie từ DB là array, length: ${cookieFromDB.length}`);
      
      // Kiểm tra nếu cookie có format QR login (có key, value)
      if (cookieFromDB.length > 0 && cookieFromDB[0].key && cookieFromDB[0].value) {
        console.log(`🔄 Converting QR login cookie format to web login format...`);
        
        // Convert từ QR format sang web format
        const convertedCookies = cookieFromDB.map(cookie => ({
          domain: cookie.domain || '.zalo.me',
          expirationDate: cookie.maxAge ? (Date.now() / 1000) + cookie.maxAge : null,
          hostOnly: cookie.hostOnly || false,
          httpOnly: cookie.httpOnly || false,
          name: cookie.key || cookie.name,
          path: cookie.path || '/',
          sameSite: cookie.sameSite || null,
          secure: cookie.secure || true,
          session: !cookie.maxAge,
          storeId: null,
          value: cookie.value
        }));
        
        console.log(`✅ Converted ${convertedCookies.length} cookies to web format`);
        return convertedCookies;
      }
      
      // Nếu đã là web format, trả về nguyên
      if (cookieFromDB.length > 0 && cookieFromDB[0].name && cookieFromDB[0].value) {
        console.log(`🍪 Cookie đã ở web format, length: ${cookieFromDB.length}`);
        return cookieFromDB;
      }
      
      return cookieFromDB;
    }
    
    // Nếu cookie là string, thử parse JSON
    if (typeof cookieFromDB === 'string') {
      if (cookieFromDB.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(cookieFromDB);
          if (Array.isArray(parsed)) {
            console.log(`🍪 Cookie string đã được parse thành array, length: ${parsed.length}`);
            // Recursive call để convert format
            return convertCookieForZca(parsed);
          }
        } catch (e) {
          console.log('Không thể parse cookie string:', e);
        }
      }
      // Nếu không phải JSON array, trả về string gốc
      console.log(`🍪 Cookie từ DB là string, length: ${cookieFromDB.length}`);
      return cookieFromDB;
    }
    
    // Nếu cookie là object, kiểm tra có cookies array không
    if (cookieFromDB && typeof cookieFromDB === 'object') {
      if (cookieFromDB.cookies && Array.isArray(cookieFromDB.cookies)) {
        console.log(`🍪 Cookie object có cookies array, length: ${cookieFromDB.cookies.length}`);
        // Recursive call để convert format
        return convertCookieForZca(cookieFromDB.cookies);
      }
      // Nếu không có cookies array, trả về object gốc
      console.log(`🍪 Cookie từ DB là object, keys: ${Object.keys(cookieFromDB).join(', ')}`);
      return cookieFromDB;
    }
    
    console.log(`🍪 Cookie từ DB có type không xác định: ${typeof cookieFromDB}`);
    return cookieFromDB;
  } catch (error) {
    console.error('Error converting cookie:', error);
    return cookieFromDB;
  }
}

export async function POST(request: NextRequest) {
  let phoneNumber: string = '';
  
  try {
    const { userId, configId, phoneNumber: reqPhoneNumber } = await request.json();
    phoneNumber = reqPhoneNumber;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc: phoneNumber' },
        { status: 400 }
      );
    }

    if (!userId && !configId) {
      return NextResponse.json(
        { error: 'Thiếu thông tin: cần userId hoặc configId' },
        { status: 400 }
      );
    }

    // Kết nối database
    await connectDB();

    // Tìm Zalo config
    const zaloConfig = await ZaloConfig.findById(configId);
    if (!zaloConfig) {
      return NextResponse.json(
        { 
          error: 'Không tìm thấy Zalo config. Vui lòng login QR trước.',
          details: 'Chưa có cookie hoặc config đã bị vô hiệu hóa'
        },
        { status: 404 }
      );
    }

    // Kiểm tra nếu là temp config (cookie rỗng)
    if (!zaloConfig.cookie || 
        (typeof zaloConfig.cookie === 'string' && zaloConfig.cookie.trim() === '') ||
        (Array.isArray(zaloConfig.cookie) && zaloConfig.cookie.length === 0) ||
        (typeof zaloConfig.cookie === 'object' && Object.keys(zaloConfig.cookie).length === 0)) {
      return NextResponse.json(
        { 
          error: 'Config chưa có cookie hợp lệ. Vui lòng login QR trước.',
          details: 'Cookie rỗng hoặc chưa được thiết lập',
          solution: 'Gọi API /api/zalo/login-qr để lấy cookie mới'
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Sử dụng Zalo config: ${zaloConfig.name} (ID: ${zaloConfig._id})`);
    console.log(`🍪 Cookie length: ${zaloConfig.cookie?.length || 0} characters`);
    console.log(`📱 IMEI: ${zaloConfig.imei}`);
    console.log(`🌐 User Agent: ${zaloConfig.userAgent}`);
    console.log(`📞 Tìm kiếm số điện thoại: ${phoneNumber}`);

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
    const convertedCookie = convertCookieForZca(zaloConfig.cookie);
    
    // Validate convertedCookie
    if (!convertedCookie || 
        (Array.isArray(convertedCookie) && convertedCookie.length === 0) ||
        (typeof convertedCookie === 'string' && convertedCookie.trim() === '')) {
      return NextResponse.json(
        { 
          error: 'Cookie không hợp lệ sau khi convert. Vui lòng login QR lại.',
          details: 'Converted cookie is empty or invalid',
          solution: 'Gọi lại API /api/zalo/login-qr để lấy cookie mới'
        },
        { status: 400 }
      );
    }
    
    console.log(`🔍 Debug Zalo constructor parameters:`);
    console.log(`   - Zalo class: ${typeof Zalo}`);
    console.log(`   - convertedCookie:`, convertedCookie);
    console.log(`   - imei: ${zaloConfig.imei}`);
    console.log(`   - userAgent: ${zaloConfig.userAgent}`);
    
    // Thử tạo Zalo instance với các format khác nhau
    let zalo;
    let constructorSuccess = false;
    
    // Thử format 1: convertedCookie (web format)
    try {
      console.log(`🔄 Thử tạo Zalo instance với convertedCookie...`);
      zalo = new Zalo({
        cookie: convertedCookie,
        imei: zaloConfig.imei,
        userAgent: zaloConfig.userAgent
      });
      console.log(`✅ Zalo instance created successfully với convertedCookie`);
      constructorSuccess = true;
    } catch (error1: any) {
      console.log(`❌ Format 1 failed:`, error1.message);
      
      // Thử format 2: cookie string đơn giản
      try {
        console.log(`🔄 Thử tạo Zalo instance với cookie string...`);
        const cookieString = convertedCookie.map((c: any) => `${c.name}=${c.value}`).join('; ');
        console.log(`🍪 Cookie string: ${cookieString}`);
        
        zalo = new Zalo({
          cookie: cookieString,
          imei: zaloConfig.imei,
          userAgent: zaloConfig.userAgent
        });
        console.log(`✅ Zalo instance created successfully với cookie string`);
        constructorSuccess = true;
      } catch (error2: any) {
        console.log(`❌ Format 2 failed:`, error2.message);
        
        // Thử format 3: cookie gốc từ database
        try {
          console.log(`🔄 Thử tạo Zalo instance với cookie gốc...`);
          zalo = new Zalo({
            cookie: zaloConfig.cookie,
            imei: zaloConfig.imei,
            userAgent: zaloConfig.userAgent
          });
          console.log(`✅ Zalo instance created successfully với cookie gốc`);
          constructorSuccess = true;
        } catch (error3: any) {
          console.log(`❌ Format 3 failed:`, error3.message);
          
          return NextResponse.json(
            { 
              error: 'Không thể tạo Zalo instance với bất kỳ format cookie nào.',
              details: `Format 1: ${error1.message}, Format 2: ${error2.message}, Format 3: ${error3.message}`,
              solution: 'Vui lòng kiểm tra thông tin config hoặc login QR lại'
            },
            { status: 500 }
          );
        }
      }
    }
    
    if (!constructorSuccess) {
      return NextResponse.json(
        { 
          error: 'Không thể tạo Zalo instance. Vui lòng kiểm tra thông tin config.',
          details: 'All cookie formats failed',
          solution: 'Kiểm tra IMEI, User Agent và Cookie format'
        },
        { status: 500 }
      );
    }

    console.log(`🚀 Khởi tạo Zalo instance với config có sẵn`);
    console.log(`🍪 Cookie type: ${typeof zaloConfig.cookie}, length: ${Array.isArray(zaloConfig.cookie) ? zaloConfig.cookie.length : zaloConfig.cookie?.length || 0}`);
    console.log(`🔄 Converted cookie type: ${typeof convertedCookie}, length: ${Array.isArray(convertedCookie) ? convertedCookie.length : convertedCookie?.length || 0}`);
    
    // Không cần gọi login() nữa vì đã có cookie valid
    const api = await zalo.login();

    // Bắt đầu lắng nghe sự kiện
    api.listener.start();

    console.log(`📡 Bắt đầu tìm kiếm người dùng...`);
    
    // Tìm người dùng qua số điện thoại
    const user = await api.findUser(phoneNumber);

    console.log(`✅ Tìm kiếm người dùng thành công: ${user ? 'Tìm thấy' : 'Không tìm thấy'}`);

    return NextResponse.json({
      success: true,
      user: user,
      phoneNumber: phoneNumber,
      configInfo: {
        configId: zaloConfig._id,
        configName: zaloConfig.name,
        lastUsed: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Find user error:', error);
    
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
        error: 'Failed to find user', 
        details: error.message,
        phoneNumber: phoneNumber,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
