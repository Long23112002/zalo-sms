import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';

// Lưu trạng thái phiên đăng nhập QR tạm thời trong bộ nhớ tiến trình
// Chỉ dùng cho môi trường dev/self-host. Với serverless, cần thay bằng store bền vững (Redis,...)
const sessions: Map<string, { done: boolean; ok?: boolean; error?: string }> = new Map();

async function ensureTmpDir(): Promise<string> {
  const dir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// Khởi tạo login bằng QR, trả về ảnh QR (base64) và sessionId để FE poll trạng thái
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userAgent: string = body?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    // Một số phiên bản ZCA yêu cầu có imei trong constructor
    const imei: string = body?.imei || `${Math.floor(1e14 + Math.random() * 9e14)}`; // 15 digits fallback

    // Dynamic import giống như logic ở login/route.ts
    let Zalo: any;
    try {
      const zcaModule: any = await import('zca-js');
      Zalo = zcaModule.Zalo || zcaModule.ZCA || zcaModule.default?.Zalo || zcaModule.default?.ZCA || zcaModule.default;
    } catch (importError) {
      console.error('Failed to import zca-js:', importError);
      return NextResponse.json(
        { error: 'Không thể load thư viện Zalo. Vui lòng kiểm tra cài đặt.' },
        { status: 500 }
      );
    }

    // Truyền đầy đủ các option an toàn cho nhiều phiên bản
    // Một số phiên bản ZCA khác nhau có constructor yêu cầu khác nhau.
    // Thử lần lượt các biến thể an toàn.
    let zalo: any = null;
    try { zalo = new Zalo({}); } catch {}
    if (!zalo) try { zalo = new Zalo(); } catch {}
    if (!zalo) try { zalo = new Zalo({ cookie: '', imei, userAgent }); } catch {}
    if (!zalo) return NextResponse.json({ error: 'Không thể khởi tạo Zalo (ZCA). Phiên bản thư viện có thể khác yêu cầu.' }, { status: 500 });

    const sessionId = (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const dir = await ensureTmpDir();
    const qrPath = path.join(dir, `qr_${sessionId}.png`);

    // Bắt đầu luồng đăng nhập ở background
    (async () => {
      try {
        let api: any;
        if (typeof (zalo as any).loginQR === 'function') {
          api = await (zalo as any).loginQR({ userAgent, qrPath });
        } else if (typeof (Zalo as any).loginQR === 'function') {
          // một số bản cung cấp static loginQR
          api = await (Zalo as any).loginQR({ userAgent, qrPath });
        } else {
          throw new Error('Thư viện không hỗ trợ loginQR trong phiên bản hiện tại');
        }
        api.listener.start();
        sessions.set(sessionId, { done: true, ok: true });
      } catch (e: any) {
        sessions.set(sessionId, { done: true, ok: false, error: e?.message || 'LoginQR failed' });
      }
    })();

    // Poll một chút để QR được ghi file, nếu chưa có thì trả null; FE sẽ gọi lại
    let qrBase64: string | null = null;
    try {
      const buf = await fs.readFile(qrPath).catch(async () => {
        // chờ file xuất hiện trong thời gian ngắn
        await new Promise(r => setTimeout(r, 300));
        try { return await fs.readFile(qrPath); } catch { return null as any; }
      });
      qrBase64 = buf ? `data:image/png;base64,${buf.toString('base64')}` : null;
    } catch { qrBase64 = null; }

    return NextResponse.json({ sessionId, qrBase64, qrPath });
  } catch (error: any) {
    console.error('QR start error:', error);
    if (error?.message && error.message.includes('sharp')) {
      return NextResponse.json(
        {
          error: 'Lỗi thư viện Sharp. Vui lòng cài đặt lại: npm install --include=optional sharp',
          details: 'Sharp module không thể load trên Windows. Hãy thử cài đặt lại.'
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error?.message || 'Cannot start QR login' }, { status: 500 });
  }
}

// Lấy trạng thái đăng nhập của một sessionId
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') || '';
  const status = sessions.get(sessionId) || { done: false };
  return NextResponse.json(status);
}


