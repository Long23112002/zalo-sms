import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '6b4f91e0b7a94663b1c3d8ff5a64a4e6d57f9c772d02c63128de64f7a05a917b';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '6b4f91e0b7a94663b1c3d8ff5a64a4e6d57f9c772d02c63128de64f7a05a917b';

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Tạo access token (15 phút)
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

// Tạo refresh token (7 ngày)
export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

// Tạo cả access và refresh token
export const generateTokenPair = (payload: JWTPayload): TokenPair => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
};

// Verify access token
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid access token');
  }
};

// Verify refresh token
export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Decode token (không verify)
export const decodeToken = (token: string): any => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};
