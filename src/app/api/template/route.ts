import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Template from '@/models/Template';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';

// GET - Lấy danh sách template của user
export async function GET(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const templates = await Template.find({ 
        userId: req.user.userId,
        isActive: true 
      }).sort({ createdAt: -1 });
      
      return NextResponse.json({
        success: true,
        templates
      });
      
    } catch (error: any) {
      console.error('Get templates error:', error);
      return NextResponse.json(
        { error: 'Không thể lấy danh sách template', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}

// POST - Tạo template mới
export async function POST(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const { name, content } = await request.json();
      
      // Validation
      if (!name || !content) {
        return NextResponse.json(
          { error: 'Tên và nội dung template là bắt buộc' },
          { status: 400 }
        );
      }
      
      // Tự động phát hiện biến trong content
      const variableRegex = /\b(xxx|yyy|sdt|ttt|zzz|www|uuu|vvv)\b/g;
      const variables = [...new Set(content.match(variableRegex) || [])];
      
      // Kiểm tra tên template đã tồn tại
      const existingTemplate = await Template.findOne({
        userId: req.user.userId,
        name: name
      });
      
      if (existingTemplate) {
        return NextResponse.json(
          { error: 'Tên template đã tồn tại' },
          { status: 409 }
        );
      }
      
      // Tạo template mới
      const template = new Template({
        userId: req.user.userId,
        name,
        content,
        variables
      });
      
      await template.save();
      
      return NextResponse.json({
        success: true,
        message: 'Tạo template thành công',
        template: {
          ...template.toObject(),
          variablesDetected: variables
        }
      });
      
    } catch (error: any) {
      console.error('Create template error:', error);
      return NextResponse.json(
        { error: 'Không thể tạo template', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}

// PUT - Cập nhật template
export async function PUT(request: NextRequest) {
  return withAuth(async (req: AuthenticatedRequest) => {
    try {
      await connectDB();
      
      if (!req.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const { id, name, content, isActive } = await request.json();
      
      if (!id) {
        return NextResponse.json(
          { error: 'ID template là bắt buộc' },
          { status: 400 }
        );
      }
      
      // Tự động phát hiện biến trong content
      const variableRegex = /\b(xxx|yyy|sdt|ttt|zzz|www|uuu|vvv)\b/g;
      const variables = [...new Set(content.match(variableRegex) || [])];
      
      // Tìm và cập nhật template
      const template = await Template.findOneAndUpdate(
        { _id: id, userId: req.user.userId },
        {
          name,
          content,
          variables,
          isActive: isActive !== undefined ? isActive : true
        },
        { new: true, runValidators: true }
      );
      
      if (!template) {
        return NextResponse.json(
          { error: 'Không tìm thấy template' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Cập nhật template thành công',
        template: {
          ...template.toObject(),
          variablesDetected: variables
        }
      });
      
    } catch (error: any) {
      console.error('Update template error:', error);
      return NextResponse.json(
        { error: 'Không thể cập nhật template', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}

// DELETE - Xóa template
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
          { error: 'ID template là bắt buộc' },
          { status: 400 }
        );
      }
      
      // Xóa template (soft delete)
      const template = await Template.findOneAndUpdate(
        { _id: id, userId: req.user.userId },
        { isActive: false },
        { new: true }
      );
      
      if (!template) {
        return NextResponse.json(
          { error: 'Không tìm thấy template' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Xóa template thành công'
      });
      
    } catch (error: any) {
      console.error('Delete template error:', error);
      return NextResponse.json(
        { error: 'Không thể xóa template', details: error.message },
        { status: 500 }
      );
    }
  })(request);
}
