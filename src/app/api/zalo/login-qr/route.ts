import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import ZaloConfig from '@/models/ZaloConfig'
import { verifyAccessToken } from '@/utils/jwt'
import path from 'path';
import { join } from 'path';
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { loginQR } from '@/base/loginQR'
import { CookieJar } from 'tough-cookie'

interface QRLoginContext {
  cookie: CookieJar;
  userAgent?: string;
  options: {
    logging: boolean;
    userAgent?: string;
    type?: string;
  };
}

interface QRLoginResult {
  type: number;
  data?: {
    image?: string;
    cookie?: any;
    imei?: string;
    userAgent?: string;
    avatar?: string;
    display_name?: string;
  };
  actions?: any;
}

interface QRLoginSession {
  done: boolean;
  ok?: boolean;
  error?: string;
  cookiePath?: string;
  cookieFilePath?: string; // Thêm đường dẫn file cookie
  accountPath?: string;
  qrPath?: string;
  cookieString?: string;
  cookieArray?: any[]; // Thêm cookie dưới dạng array
  account?: {
    imei: string;
    userAgent: string;
    avatar?: string;
    display_name?: string;
  };
  configId?: string;
  dbSaved?: boolean;
  dbError?: string;
  needsAuth?: boolean;
  userInfo?: {
    avatar?: string;
    display_name?: string;
  };
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Simple logger
const logger = {
  log: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toISOString()
    // eslint-disable-next-line no-console
    console.log(`[${timestamp}] [${level?.toUpperCase?.() || 'INFO'}] ${message}`)
  }
}

// In-memory session store for dev/self-host
const sessions = new Map<string, QRLoginSession>()

async function ensureTmpDir(): Promise<string> {
  const dir = path.join(process.cwd(), 'tmp')
  await fs.mkdir(dir, { recursive: true })
  return dir
}

async function ensureSessionDir(sessionId: string): Promise<string> {
  const base = await ensureTmpDir()
  const sessionDir = path.join(base, sessionId)
  await fs.mkdir(sessionDir, { recursive: true })
  return sessionDir
}

// Thêm hàm lưu cookie vào file
async function saveCookieToFile(sessionId: string, cookieData: any, cookieString: string, metadata: any): Promise<string> {
  try {
    const sessionDir = await ensureSessionDir(sessionId)
    const cookieFilePath = path.join(sessionDir, 'cookies.json')
    
    const cookieFileData = {
      sessionId,
      timestamp: new Date().toISOString(),
      cookieString,
      cookieArray: cookieData,
      metadata,
      filePath: cookieFilePath
    }
    
    await fs.writeFile(cookieFilePath, JSON.stringify(cookieFileData, null, 2), 'utf8')
    logger.log(`💾 Cookie đã được lưu vào file: ${cookieFilePath}`, 'info')
    return cookieFilePath
  } catch (error) {
    logger.log(`❌ Lỗi khi lưu cookie vào file: ${(error as any)?.message}`, 'error')
    return ''
  }
}

function saveBase64Image(base64String: string, outputPath: string): void {
  const matches = base64String.match(/^data:(image\/\w+);base64,(.+)$/)
  let base64Data = base64String
  if (matches) base64Data = matches[2]
  fsSync.mkdirSync(path.dirname(outputPath), { recursive: true })
  fsSync.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'))
}

function cookieEntryToPair(entry: any): string | null {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const str = entry.trim();
    return str.includes('=') ? str : null;
  }
  if (typeof entry === 'object') {
    const name = entry.name ?? entry.key ?? entry.CookieName ?? entry.cookieName ?? entry.n ?? entry.k;
    const value = entry.value ?? entry.val ?? entry.v ?? entry.content ?? entry.cookieValue ?? entry.CookieValue;
    if (typeof name === 'string' && typeof value === 'string') return `${name}=${value}`;
    const keys = Object.keys(entry);
    if (keys.length === 1) {
      const k = keys[0];
      const v = entry[k];
      if (typeof v === 'string') return `${k}=${v}`;
    }
  }
  return null;
}

function toCookieString(cookieInput: any): string {
  try {
    if (!cookieInput) return '';
    if (typeof cookieInput === 'string') {
      const s = cookieInput.trim();
      if (!s) return '';
      if (!s.startsWith('[')) return s;
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.map(cookieEntryToPair).filter(Boolean).join('; ');
      } catch {}
      return s;
    }
    if (Array.isArray(cookieInput)) {
      return cookieInput.map(cookieEntryToPair).filter(Boolean).join('; ');
    }
    if (cookieInput && typeof cookieInput === 'object') {
      const arr = (cookieInput as any).cookies;
      if (Array.isArray(arr)) return arr.map(cookieEntryToPair).filter(Boolean).join('; ');
    }
    return '';
  } catch { return ''; }
}

const getJsonData = (filePath: string, defaultData: any = {}): any => {
  fsSync.mkdirSync(path.dirname(filePath), { recursive: true })
  if (!fsSync.existsSync(filePath)) {
    logger.log(`File ${path.basename(filePath)} chưa tồn tại, tạo mới.`, 'warn')
    fsSync.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8')
    return defaultData
  }
  const raw = fsSync.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

// POST: start QR login flow, return sessionId and initial qrBase64 (if available)
export async function POST(request: NextRequest) {
  let sessionId = '';
  let qrPath = '';
  let qrBase64: string | null = null;
  
  try {
    const body = await request.json().catch(() => ({}))
    // Optional auth: extract userId if there is a valid access token; do NOT require it
    const authHeader = request.headers.get('authorization') || ''
    let userId: string | undefined
    
    logger.log(`🔑 Auth header received: ${authHeader ? 'Yes' : 'No'}`, 'info');
    if (authHeader.startsWith('Bearer ')) {
      logger.log(`🔑 Bearer token found, length: ${authHeader.length}`, 'info');
      try { 
        const token = authHeader.slice(7);
        logger.log(`🔑 Token extracted, length: ${token.length}`, 'info');
        const decoded: any = verifyAccessToken(token); 
        userId = decoded?.userId;
        logger.log(`🔑 Token decoded successfully, userId: ${userId || 'undefined'}`, 'info');
        logger.log(`🔑 Full decoded payload: ${JSON.stringify(decoded)}`, 'info');
      } catch (authErr) {
        logger.log(`❌ Auth token error: ${(authErr as any)?.message}`, 'warn');
        logger.log(`🔍 Token verification failed, will proceed without userId`, 'warn');
      }
    } else {
      logger.log(`⚠️ No valid authorization header found`, 'warn');
    }
    
    logger.log(`👤 Final userId for this request: ${userId || 'undefined'}`, 'info');
    const userAgent: string = body?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    const zcaConfig = body?.zcaConfig || body?.zca_js_config || body?.config || {}

    sessionId = (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    const dir = await ensureTmpDir()
   const qrFileName = `qr_${sessionId}.png`;
const qrPath = join(dir, qrFileName);

    // Run in background
    (async () => {
      try {
        logger.log(`🚀 Bắt đầu quá trình login QR cho session ${sessionId}`, 'info');
        const context: QRLoginContext = {
          cookie: new CookieJar(),
          userAgent,
          options: {
            logging: true,
            userAgent,
            type: 'qr'
          }
        };

        logger.log(`🔧 Context được tạo với userAgent: ${userAgent}`, 'info');
        logger.log(`📁 QR sẽ được lưu tại: ${qrPath}`, 'info');

        await loginQR(
          context, 
          { qrPath }, 
          async (result: { type: number; data?: any; actions?: any }) => {
            try {
              logger.log(`🔄 Callback QR login nhận được result type: ${result.type}`, 'info');
              if (!result.data) {
                logger.log(`⚠️ Không có data trong result`, 'warn');
                return;
              }

              const { image, cookie, imei, userAgent: cbUA, avatar, display_name } = result.data;

              // Handle QR code image
              if (image && !cookie) {
                console.log('📱 QR Image received, waiting for scan...');
                saveBase64Image(image, qrPath);
                logger.log(`✅ QR Code đã được lưu tại: ${path.basename(qrPath)}`, 'info');
                logger.log(`📁 Full path: ${qrPath}`, 'info');
                
                // Cập nhật session với QR path
                const currentSession = sessions.get(sessionId);
                if (currentSession) {
                  sessions.set(sessionId, {
                    ...currentSession,
                    qrPath,
                    done: false,
                    ok: true
                  });
                  logger.log(`🔄 Session ${sessionId} đã được cập nhật với QR path`, 'info');
                }
                
                logger.log(`Vui lòng quét mã QRCode ${path.basename(qrPath)} để đăng nhập`, 'info');
                return;
              }

              // Handle successful login
              if (userAgent && cookie && imei) {
                console.log('✅ Login successful! Processing credentials...');
                
                // Chuẩn hóa cookie
                const cookieString = cookie ? toCookieString(cookie) : '';
                
                // Thêm log chi tiết về cookie
                logger.log(`🔐 Cookie nhận được khi login QR thành công:`, 'info');
                logger.log(`📊 Tổng số cookie: ${Array.isArray(cookie) ? cookie.length : 'N/A'}`, 'info');
                logger.log(`📝 Cookie string: ${cookieString}`, 'info');
                
                // Log cookie dưới dạng array
                logger.log(`📋 Cookie dưới dạng array:`, 'info');
                if (Array.isArray(cookie)) {
            
                  cookie.forEach((cookieEntry, index) => {
                    try {
                      const cookiePair = cookieEntryToPair(cookieEntry);
                      if (cookiePair) {
                        logger.log(`🍪 Cookie ${index + 1}: ${cookiePair}`, 'info');
                      }
                    } catch (err) {
                      logger.log(`❌ Lỗi xử lý cookie ${index + 1}: ${(err as any)?.message}`, 'warn');
                    }
                  });
                } else if (typeof cookie === 'object' && cookie !== null) {
                  logger.log(`🔍 Cookie object keys: ${Object.keys(cookie).join(', ')}`, 'info');
                  logger.log(`🍪 Cookie object: ${JSON.stringify(cookie, null, 2)}`, 'info');
                  if (cookie.cookies && Array.isArray(cookie.cookies)) {
                    logger.log(`📦 Cookie.cookies array length: ${cookie.cookies.length}`, 'info');
                    logger.log(`🍪 Cookie.cookies array: ${JSON.stringify(cookie.cookies, null, 2)}`, 'info');
                    cookie.cookies.forEach((cookieEntry: any, index: number) => {
                      try {
                        const cookiePair = cookieEntryToPair(cookieEntry);
                        if (cookiePair) {
                          logger.log(`🍪 Cookie.cookies[${index}]: ${cookiePair}`, 'info');
                        }
                      } catch (err) {
                        logger.log(`❌ Lỗi xử lý cookie.cookies[${index}]: ${(err as any)?.message}`, 'warn');
                      }
                    });
                  }
                }
                
                // Log thông tin IMEI và User Agent
                logger.log(`📱 IMEI: ${imei}`, 'info');
                logger.log(`🌐 User Agent: ${cbUA}`, 'info');
                if (avatar) logger.log(`🖼️ Avatar: ${avatar}`, 'info');
                if (display_name) logger.log(`👤 Display Name: ${display_name}`, 'info');

               
                
                // Lấy user info từ session nếu có
                const currentSession = sessions.get(sessionId);
                const savedAvatar = currentSession?.userInfo?.avatar || avatar;
                const savedDisplayName = currentSession?.userInfo?.display_name || display_name;

                // Lưu cookie vào file tmp
                const metadata = {
                  imei,
                  userAgent: cbUA,
                  avatar: savedAvatar,
                  display_name: savedDisplayName,
                  userId: userId || 'anonymous',
                  loginTime: new Date().toISOString()
                }
                
                const cookieFilePath = await saveCookieToFile(sessionId, cookie, cookieString, metadata)
                
                // Lưu vào MongoDB bảng ZaloConfig cho user hiện tại (nếu có token)
                try {
                  logger.log(`🔌 Đang kết nối database...`, 'info');
                  await connectDB()
                  logger.log(`✅ Kết nối database thành công`, 'info');
                  
                  const name = `QR-${new Date().toISOString().slice(0,19).replace('T',' ')}`
                  
                  // Lưu cookie gốc thay vì cookieString để zca-js-16 có thể sử dụng
                  let cookieToSave: any;
                  if (Array.isArray(cookie)) {
                    cookieToSave = cookie; // Lưu nguyên array
                  } else if (cookie && typeof cookie === 'object') {
                    cookieToSave = cookie; // Lưu nguyên object
                  } else {
                    cookieToSave = cookieString; // Fallback về string nếu không có gì khác
                  }
                  
                  const doc: any = {
                    userId: userId ?? undefined,
                    name: savedDisplayName || name,
                    cookie: cookieToSave, // Lưu cookie gốc thay vì cookieString
                    imei,
                    userAgent: cbUA,
                    avatar: savedAvatar,
                    display_name: savedDisplayName,
                    isActive: true
                  }
                  
                  logger.log(`📄 Document prepared for save:`, 'info');
                  logger.log(`   - userId: ${doc.userId}`, 'info');
                  logger.log(`   - name: ${doc.name}`, 'info');
                  logger.log(`   - cookie type: ${typeof doc.cookie}`, 'info');
                  logger.log(`   - cookie length: ${Array.isArray(doc.cookie) ? doc.cookie.length : doc.cookie?.length || 0}`, 'info');
                  logger.log(`   - imei: ${doc.imei}`, 'info');
                  logger.log(`   - userAgent: ${doc.userAgent}`, 'info');
                  
                  // Nếu không có user (không auth), chỉ bỏ qua lưu DB
                  if (userId) {
                    logger.log(`💾 Đang lưu cookie vào database cho user ${userId}...`, 'info');
                    
                    // Deactivate tất cả config cũ của user này
                    try {
                      logger.log(`🔄 Deactivating tất cả config cũ của user ${userId}...`, 'info');
                      const deactivateResult = await (ZaloConfig as any).updateMany(
                        { userId: userId },
                        { $set: { isActive: false } }
                      );
                      logger.log(`✅ Đã deactivate ${deactivateResult.modifiedCount} config cũ`, 'info');
                    } catch (deactivateErr) {
                      logger.log(`⚠️ Lỗi khi deactivate config cũ: ${(deactivateErr as any)?.message}`, 'warn');
                      // Tiếp tục tạo config mới ngay cả khi deactivate thất bại
                    }
                    
                    logger.log(`📄 Document to save:`, 'info');
                    logger.log(`   - userId: ${doc.userId}`, 'info');
                    logger.log(`   - name: ${doc.name}`, 'info');
                    logger.log(`   - cookie type: ${typeof doc.cookie}`, 'info');
                    logger.log(`   - cookie length: ${Array.isArray(doc.cookie) ? doc.cookie.length : doc.cookie?.length || 0}`, 'info');
                    logger.log(`   - imei: ${doc.imei}`, 'info');
                    logger.log(`   - userAgent: ${doc.userAgent}`, 'info');
                    
                    logger.log(`🔍 Document object:`, 'info');
                    logger.log(JSON.stringify(doc, null, 2), 'info');
                    
                    const created = await (ZaloConfig as any).create(doc)
                    logger.log(`✅ Cookie đã được lưu thành công vào database với ID: ${created?._id?.toString()}`, 'info');
                    logger.log(`🎯 User ${userId} giờ chỉ có 1 config active duy nhất`, 'info');
                    
                    sessions.set(sessionId, { 
                      ...(sessions.get(sessionId) || {}), 
                      configId: created?._id?.toString(), 
                      cookieString, 
                      cookieArray: cookie, // Lưu cookie dưới dạng array
                      cookieFilePath, // Lưu đường dẫn file cookie
                      account: { 
                        imei, 
                        userAgent: cbUA, 
                        avatar: savedAvatar, 
                        display_name: savedDisplayName 
                      }, 
                      done: true, 
                      ok: true, 
                      qrPath, 
                      dbSaved: true 
                    })
                  } else {
                    logger.log(`⚠️ Không có user ID, bỏ qua việc lưu cookie vào database`, 'warn');
                    logger.log(`🔍 Debug info:`, 'warn');
                    logger.log(`   - userId from token: ${userId}`, 'warn');
                    logger.log(`   - authHeader: ${request.headers.get('authorization') ? 'Yes' : 'No'}`, 'warn');
                    logger.log(`   - doc.userId: ${doc.userId}`, 'warn');
                    sessions.set(sessionId, { 
                      ...(sessions.get(sessionId) || {}), 
                      cookieString, 
                      cookieArray: cookie, // Lưu cookie dưới dạng array
                      cookieFilePath, // Lưu đường dẫn file cookie
                      account: { 
                        imei, 
                        userAgent: cbUA, 
                        avatar: savedAvatar, 
                        display_name: savedDisplayName 
                      }, 
                      done: true, 
                      ok: true, 
                      qrPath, 
                      needsAuth: true 
                    })
                  }
                  
                  // Xoá ảnh QR sau khi login thành công để tránh nặng server
                  try { await fs.unlink(qrPath).catch(() => {}) } catch {}
                } catch (dbErr) {
                  // Nếu lỗi DB, vẫn tiếp tục flow
                  logger.log(`❌ Lỗi khi lưu cookie vào database: ${(dbErr as any)?.message || String(dbErr || '')}`, 'error');
                  logger.log(`🔍 Stack trace: ${(dbErr as any)?.stack || 'N/A'}`, 'error');
                  logger.log(`🔍 Cookie vẫn được lưu trong session: ${cookieString}`, 'info');
                  sessions.set(sessionId, { 
                    ...(sessions.get(sessionId) || {}), 
                    cookieString, 
                    cookieArray: cookie, // Lưu cookie dưới dạng array
                    cookieFilePath, // Lưu đường dẫn file cookie
                    account: { 
                      imei, 
                      userAgent: cbUA, 
                      avatar: savedAvatar, 
                      display_name: savedDisplayName 
                    }, 
                    done: true, 
                    ok: true, 
                    qrPath, 
                    dbError: (dbErr as any)?.message || String(dbErr || '') 
                  })
                  try { await fs.unlink(qrPath).catch(() => {}) } catch {}
                }
              }
            } catch (error) {
              console.error('QR callback error:', error);
              logger.log(`❌ Lỗi trong callback QR login: ${(error as any)?.message || String(error || '')}`, 'error');
              logger.log(`🔍 Stack trace: ${(error as any)?.stack || 'N/A'}`, 'error');
            }
          }
        )
        
        const current = sessions.get(sessionId)
        if (!current?.done) {
          sessions.set(sessionId, { done: true, ok: true, qrPath })
          logger.log(`✅ Session ${sessionId} đã được tạo thành công`, 'info');
        }
      } catch (e: any) {
        logger.log(`❌ Lỗi trong quá trình login QR: ${e?.message || String(e || '')}`, 'error');
        logger.log(`🔍 Stack trace: ${e?.stack || 'N/A'}`, 'error');
        sessions.set(sessionId, { done: true, ok: false, error: e?.message || 'LoginQR failed' })
      }
    })()

    // After starting the login process, try to read QR file 
    try {
      // Tăng delay để đảm bảo file được tạo
      await new Promise((r) => setTimeout(r, 1000))
      
      // Kiểm tra file có tồn tại không trước khi đọc
      try {
        await fs.access(qrPath)
        logger.log(`📁 QR file đã được tạo tại: ${qrPath}`, 'info');
      } catch (accessErr) {
        logger.log(`⚠️ QR file chưa tồn tại tại: ${qrPath}`, 'warn');
        logger.log(`⏳ Đang chờ file được tạo...`, 'info');
        // Thử đọc lại sau 1 giây nữa
        await new Promise((r) => setTimeout(r, 1000))
      }
      
      const buf = await fs.readFile(qrPath)
      if (buf) {
        qrBase64 = `data:image/png;base64,${buf.toString('base64')}`
        logger.log(`✅ QR file đã được đọc thành công, size: ${buf.length} bytes`, 'info');
      }
    } catch (err) {
      logger.log(`❌ Lỗi đọc QR file: ${(err as any)?.message}`, 'warn');
      logger.log(`🔍 File path: ${qrPath}`, 'warn');
      logger.log(`💡 File sẽ được đọc khi client poll status`, 'info');
    }

    sessions.set(sessionId, { ...(sessions.get(sessionId) || { done: false }), qrPath })
    logger.log(`🎯 Session ${sessionId} đã được khởi tạo với qrPath: ${qrPath}`, 'info');
    logger.log(`📋 Session data: ${JSON.stringify({ sessionId, qrPath, hasQrBase64: !!qrBase64 })}`, 'info');
    return NextResponse.json({ sessionId, qrBase64, qrPath })
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('QR start error:', error)
    if (error?.message && error.message.includes('sharp')) {
      return NextResponse.json(
        {
          error: 'Lỗi thư viện Sharp. Vui lòng cài đặt lại: npm install --include=optional sharp',
          details: 'Sharp module không thể load trên Windows. Hãy thử cài đặt lại.'
        },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: error?.message || 'Cannot start QR login' }, { status: 500 })
  }
}

// GET: poll status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId') || ''
  const status = (sessions.get(sessionId) || { done: false }) as any
  let qrBase64: string | null = null
  const qrPath = status?.qrPath as string | undefined
  
  logger.log(`📊 GET request cho session ${sessionId}`, 'info');
  logger.log(`🔍 Session status: ${JSON.stringify({ done: status.done, ok: status.ok, hasQrPath: !!qrPath })}`, 'info');
  
  if (qrPath) {
    try {
      // Kiểm tra file có tồn tại không
      await fs.access(qrPath);
      logger.log(`📁 QR file tồn tại tại: ${qrPath}`, 'info');
      
      const buf = await fs.readFile(qrPath);
      if (buf) {
        qrBase64 = `data:image/png;base64,${buf.toString('base64')}`;
        logger.log(`✅ QR file đã được đọc thành công, size: ${buf.length} bytes`, 'info');
      }
    } catch (err) {
      logger.log(`❌ Lỗi đọc QR file: ${(err as any)?.message}`, 'warn');
      logger.log(`🔍 File path: ${qrPath}`, 'warn');
      qrBase64 = null;
    }
  } else {
    logger.log(`⚠️ Không có QR path trong session ${sessionId}`, 'warn');
  }
  
  // Log thông tin session khi GET request
  if (status?.done && status?.ok) {
    logger.log(`📊 Session ${sessionId} completed:`, 'info');
    logger.log(`🍪 Cookie string: ${status.cookieString || 'N/A'}`, 'info');
    if (status.cookieFilePath) {
      logger.log(`📁 Cookie file saved at: ${status.cookieFilePath}`, 'info');
    }
  }
  
  // Trả về thông tin đã có sẵn trong session (không đọc file cookie/account nữa)
  return NextResponse.json({ ...status, qrBase64, qrPath })
}