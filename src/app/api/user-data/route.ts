import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import UserData from '@/models/UserData';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET - Lấy danh sách user data của user
export async function GET(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const userDataList = await UserData.find({ 
        userId: req.user.userId,
        isActive: true 
      }).sort({ createdAt: -1 });
      
      return NextResponse.json({
        success: true,
        userDataList
      });
      
    } catch (error: any) {
      console.error('Get user data error:', error);
      return NextResponse.json(
        { error: 'Không thể lấy danh sách dữ liệu', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}

// POST - Tạo hoặc cập nhật user data (bulk)
export async function POST(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const { dataList } = await request.json();
      
      if (!Array.isArray(dataList) || dataList.length === 0) {
        return NextResponse.json(
          { error: 'Danh sách dữ liệu không hợp lệ' },
          { status: 400 }
        );
      }
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (const data of dataList) {
        try {
          const { phone, xxx, yyy, sdt, ttt, zzz, www, uuu, vvv, customFields } = data;
          
          if (!phone) {
            results.push({ phone: 'N/A', success: false, error: 'Số điện thoại là bắt buộc' });
            errorCount++;
            continue;
          }
          
          // Tìm và cập nhật hoặc tạo mới
          const userData = await UserData.findOneAndUpdate(
            { userId: req.user.userId, phone },
            {
              xxx, yyy, sdt, ttt, zzz, www, uuu, vvv, customFields,
              isActive: true
            },
            { 
              new: true, 
              upsert: true, 
              runValidators: true,
              setDefaultsOnInsert: true
            }
          );
          
          results.push({ phone, success: true, data: userData });
          successCount++;
          
        } catch (error: any) {
          results.push({ 
            phone: data.phone || 'N/A', 
            success: false, 
            error: error.message 
          });
          errorCount++;
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Xử lý thành công ${successCount}/${dataList.length} bản ghi`,
        results,
        summary: {
          total: dataList.length,
          success: successCount,
          error: errorCount
        }
      });
      
    } catch (error: any) {
      console.error('Create/Update user data error:', error);
      return NextResponse.json(
        { error: 'Không thể xử lý dữ liệu', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}

// PUT - Cập nhật user data
export async function PUT(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const { id, phone, xxx, yyy, sdt, ttt, zzz, www, uuu, vvv, customFields } = await request.json();
      
      if (!id) {
        return NextResponse.json(
          { error: 'ID là bắt buộc' },
          { status: 400 }
        );
      }
      
      // Tìm và cập nhật user data
      const userData = await UserData.findOneAndUpdate(
        { _id: id, userId: req.user.userId },
        {
          phone, xxx, yyy, sdt, ttt, zzz, www, uuu, vvv, customFields
        },
        { new: true, runValidators: true }
      );
      
      if (!userData) {
        return NextResponse.json(
          { error: 'Không tìm thấy dữ liệu' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Cập nhật thành công',
        userData
      });
      
    } catch (error: any) {
      console.error('Update user data error:', error);
      return NextResponse.json(
        { error: 'Không thể cập nhật dữ liệu', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}

// DELETE - Xóa user data
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
          { error: 'ID là bắt buộc' },
          { status: 400 }
        );
      }
      
      // Xóa user data (soft delete)
      const userData = await UserData.findOneAndUpdate(
        { _id: id, userId: req.user.userId },
        { isActive: false },
        { new: true }
      );
      
      if (!userData) {
        return NextResponse.json(
          { error: 'Không tìm thấy dữ liệu' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Xóa thành công'
      });
      
    } catch (error: any) {
      console.error('Delete user data error:', error);
      return NextResponse.json(
        { error: 'Không thể xóa dữ liệu', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}
