import { Zalo } from 'zca-js'

export interface QRLoginContext {
  cookie: any;
  userAgent?: string;
  options: {
    logging: boolean;
    userAgent?: string;
    type?: string;
  };
}

export interface QRLoginOptions {
  userAgent?: string;
  qrPath?: string;
}

export interface QRLoginCallback {
  (result: { type: number; data?: any; actions?: any }): void;
}

export async function loginQR(
  context: QRLoginContext,
  options: QRLoginOptions,
  callback: QRLoginCallback
): Promise<any> {
  try {
    // Sử dụng phiên bản mới nhất của zca-js với Zalo class
    const zalo = new Zalo({
      userAgent: context.userAgent || options.userAgent
    } as any);
    
    return await zalo.loginQR(options, callback);
  } catch (error) {
    console.error('LoginQR error:', error);
    throw error;
  }
}
