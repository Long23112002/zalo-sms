import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/models/User';
import { generateTokenPair } from '@/utils/jwt';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { username, password } = await request.json();
    
    // Validation
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username và password là bắt buộc' },
        { status: 400 }
      );
    }
    
    // Tìm user
    const user = await User.findOne({ username });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Username hoặc password không đúng' },
        { status: 401 }
      );
    }
    
    // Kiểm tra password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Username hoặc password không đúng' },
        { status: 401 }
      );
    }
    
    // Kiểm tra user có active không
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Tài khoản đã bị khóa' },
        { status: 403 }
      );
    }
    
    // Tạo tokens
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      username: user.username,
      role: user.role
    });
    
    // Cập nhật lastLogin
    user.lastLogin = new Date();
    await user.save();
    
    return NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      },
      tokens
    });
    
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Đăng nhập thất bại', details: error.message },
      { status: 500 }
    );
  }
}
