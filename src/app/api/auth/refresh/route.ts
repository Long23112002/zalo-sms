import { NextRequest, NextResponse } from 'next/server';
import { generateAccessToken, verifyRefreshToken } from '@/utils/jwt';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    let refreshToken = '';

    if (authHeader.startsWith('Bearer ')) {
      refreshToken = authHeader.replace('Bearer ', '').trim();
    } else {
      const body = await request.json().catch(() => ({}));
      refreshToken = body?.refreshToken || '';
    }

    if (!refreshToken) {
      return NextResponse.json({ error: 'Missing refresh token' }, { status: 400 });
    }

    const payload = verifyRefreshToken(refreshToken);
    const accessToken = generateAccessToken({
      userId: payload.userId,
      username: payload.username,
      role: payload.role
    });

    return NextResponse.json({ success: true, accessToken });
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
  }
}
