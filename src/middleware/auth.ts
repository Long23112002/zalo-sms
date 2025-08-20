import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    username: string;
    role: string;
  };
}

export function authMiddleware(request: AuthenticatedRequest): NextResponse | null {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Access token required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = verifyAccessToken(token);
      request.user = decoded;
      return null; // Continue to next middleware/route
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired access token' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

// Higher-order function để wrap API routes
export function withAuth(handler: Function) {
  return async (request: NextRequest) => {
    const authResult = authMiddleware(request as AuthenticatedRequest);
    if (authResult) return authResult;
    
    // Nếu auth thành công, gọi handler
    return handler(request as AuthenticatedRequest);
  };
}
