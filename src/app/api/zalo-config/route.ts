import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import ZaloConfig from '@/models/ZaloConfig';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET - Lấy danh sách cấu hình Zalo của user
export async function GET(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const configs = await ZaloConfig.find({ 
        userId: req.user.userId,
        isActive: true 
      }).sort({ createdAt: -1 });
      
      return NextResponse.json({
        success: true,
        configs
      });
      
    } catch (error: any) {
      console.error('Get Zalo configs error:', error);
      return NextResponse.json(
        { error: 'Không thể lấy danh sách cấu hình', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}

// POST - Tạo cấu hình Zalo mới
export async function POST(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const { name, cookie, imei, userAgent, proxy } = await request.json();
      
      // Validation
      if (!name || !cookie || !imei || !userAgent) {
        return NextResponse.json(
          { error: 'Tên, cookie, IMEI và User Agent là bắt buộc' },
          { status: 400 }
        );
      }
      
      // Xử lý cookie format - đảm bảo luôn lưu dưới dạng string
      let cookieToSave = '';
      
      if (Array.isArray(cookie)) {
        // Nếu cookie là array, chuyển thành string format để lưu
        cookieToSave = cookie
          .map(c => `${c.name}=${c.value}`)
          .join('; ');
      } else if (typeof cookie === 'string') {
        // Nếu cookie đã là string, kiểm tra xem có phải JSON string không
        if (cookie.trim().startsWith('[')) {
          try {
            const cookieArray = JSON.parse(cookie);
            if (Array.isArray(cookieArray)) {
              // Nếu là JSON string chứa array, convert thành string format
              cookieToSave = cookieArray
                .map(c => `${c.name}=${c.value}`)
                .join('; ');
            } else {
              // Nếu parse ra không phải array, giữ nguyên
              cookieToSave = cookie;
            }
          } catch (parseError) {
            console.error('Error parsing cookie JSON string:', parseError);
            // Nếu parse lỗi, giữ nguyên cookie gốc
            cookieToSave = cookie;
          }
        } else {
          // Cookie đã là string format đúng
          cookieToSave = cookie;
        }
      } else {
        // Nếu cookie không phải array cũng không phải string, trả về lỗi
        return NextResponse.json(
          { error: 'Cookie không đúng định dạng. Phải là array hoặc string.' },
          { status: 400 }
        );
      }

      // Log để debug
      console.log('Cookie processing:', {
        originalType: typeof cookie,
        isArray: Array.isArray(cookie),
        finalFormat: 'string',
        finalLength: cookieToSave.length
      });
      
      // Kiểm tra tên đã tồn tại
      const existingConfig = await ZaloConfig.findOne({
        userId: req.user.userId,
        name: name
      });
      
      if (existingConfig) {
        return NextResponse.json(
          { error: 'Tên cấu hình đã tồn tại' },
          { status: 409 }
        );
      }
      
      // Tạo cấu hình mới
      const config = new ZaloConfig({
        userId: req.user.userId,
        name,
        cookie: cookieToSave,
        imei,
        userAgent,
        proxy: proxy || undefined
      });
      
      await config.save();
      
      return NextResponse.json({
        success: true,
        message: 'Tạo cấu hình thành công',
        config: {
          ...config.toObject(),
          cookieFormat: 'string',
          cookieProcessed: true
        }
      });
      
    } catch (error: any) {
      console.error('Create Zalo config error:', error);
      return NextResponse.json(
        { error: 'Không thể tạo cấu hình', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}

// PUT - Cập nhật cấu hình Zalo
export async function PUT(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const { id, name, cookie, imei, userAgent, proxy, isActive } = await request.json();
      
      if (!id) {
        return NextResponse.json(
          { error: 'ID cấu hình là bắt buộc' },
          { status: 400 }
        );
      }
      
      // Xử lý cookie format - đảm bảo luôn lưu dưới dạng string
      let cookieToSave = '';
      
      if (Array.isArray(cookie)) {
        // Nếu cookie là array, chuyển thành string format để lưu
        cookieToSave = cookie
          .map(c => `${c.name}=${c.value}`)
          .join('; ');
      } else if (typeof cookie === 'string') {
        // Nếu cookie đã là string, kiểm tra xem có phải JSON string không
        if (cookie.trim().startsWith('[')) {
          try {
            const cookieArray = JSON.parse(cookie);
            if (Array.isArray(cookieArray)) {
              // Nếu là JSON string chứa array, convert thành string format
              cookieToSave = cookieArray
                .map(c => `${c.name}=${c.value}`)
                .join('; ');
            } else {
              // Nếu parse ra không phải array, giữ nguyên
              cookieToSave = cookie;
            }
          } catch (parseError) {
            console.error('Error parsing cookie JSON string:', parseError);
            // Nếu parse lỗi, giữ nguyên cookie gốc
            cookieToSave = cookie;
          }
        } else {
          // Cookie đã là string format đúng
          cookieToSave = cookie;
        }
      } else {
        // Nếu cookie không phải array cũng không phải string, trả về lỗi
        return NextResponse.json(
          { error: 'Cookie không đúng định dạng. Phải là array hoặc string.' },
          { status: 400 }
        );
      }

      // Log để debug
      console.log('Cookie processing (PUT):', {
        originalType: typeof cookie,
        isArray: Array.isArray(cookie),
        finalFormat: 'string',
        finalLength: cookieToSave.length
      });
      
      // Tìm và cập nhật cấu hình
      const config = await ZaloConfig.findOneAndUpdate(
        { _id: id, userId: req.user.userId },
        {
          name,
          cookie: cookieToSave,
          imei,
          userAgent,
          proxy: proxy || undefined,
          isActive: isActive !== undefined ? isActive : true
        },
        { new: true, runValidators: true }
      );
      
      if (!config) {
        return NextResponse.json(
          { error: 'Không tìm thấy cấu hình' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Cập nhật cấu hình thành công',
        config: {
          ...config.toObject(),
          cookieFormat: 'string',
          cookieProcessed: true
        }
      });
      
    } catch (error: any) {
      console.error('Update Zalo config error:', error);
      return NextResponse.json(
        { error: 'Không thể cập nhật cấu hình', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}

// DELETE - Xóa cấu hình Zalo
export async function DELETE(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      
      if (!id) {
        return NextResponse.json(
          { error: 'ID cấu hình là bắt buộc' },
          { status: 400 }
        );
      }
      
      // Xóa cấu hình (soft delete)
      const config = await ZaloConfig.findOneAndUpdate(
        { _id: id, userId: req.user.userId },
        { isActive: false },
        { new: true }
      );
      
      if (!config) {
        return NextResponse.json(
          { error: 'Không tìm thấy cấu hình' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Xóa cấu hình thành công'
      });
      
    } catch (error: any) {
      console.error('Delete Zalo config error:', error);
      return NextResponse.json(
        { error: 'Không thể xóa cấu hình', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}
