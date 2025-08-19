import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/models/User';
import { generateTokenPair } from '@/utils/jwt';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { username, email, password, fullName } = await request.json();
    
    // Validation
    if (!username || !email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Tất cả các trường là bắt buộc' },
        { status: 400 }
      );
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }
    
    // Kiểm tra user đã tồn tại
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username hoặc email đã tồn tại' },
        { status: 409 }
      );
    }
    
    // Tạo user mới
    const user = new User({
      username,
      email,
      password,
      fullName,
      role: 'user'
    });
    
    await user.save();
    
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
      message: 'Đăng ký thành công',
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
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Đăng ký thất bại', details: error.message },
      { status: 500 }
    );
  }
}
