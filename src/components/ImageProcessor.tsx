'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';

interface ProcessedImage {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: {
    soCanCuoc: string;
    hoVaTen: string;
    noiThuongTru: string;
    rawResponse: string;
  };
  error?: string;
}

interface BatchConfig {
  batchSize: number;
  delayBetweenBatches: number;
  delayBetweenImages: number; // Kept for backward compatibility but not used
}

export default function ImageProcessor() {
  const [images, setImages] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [batchConfig, setBatchConfig] = useState<BatchConfig>({
    batchSize: 10,
    delayBetweenBatches: 2000,
    delayBetweenImages: 0
  });
  
  // Debug logging cho batchConfig
  useEffect(() => {
    console.log('🔧 batchConfig updated:', batchConfig);
  }, [batchConfig]);
  
  const [googleApiKey, setGoogleApiKey] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 50) {
      alert('Chỉ được chọn tối đa 50 ảnh!');
      return;
    }
    
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') && 
      ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)
    );
    
    setImages(validFiles);
    setProcessedImages([]);
    setCurrentBatch(0);
    setTotalBatches(Math.ceil(validFiles.length / batchConfig.batchSize));
  };

  const processImagesWithGemini = async (imageFiles: File[]): Promise<ProcessedImage['result'][]> => {
    // Convert all images to base64
    const imagePromises = imageFiles.map(async (imageFile) => {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(imageFile);
      });
      return base64.split(',')[1]; // Remove data:image/...;base64, prefix
    });

    const imageDataArray = await Promise.all(imagePromises);

    // Create content array with text and multiple images
    const content = [
      {
        text: `Hãy trích xuất thông tin từ ${imageFiles.length} ảnh căn cước công dân này. Trả về kết quả theo định dạng JSON array với mỗi phần tử có các trường: soCanCuoc (số căn cước công dân), hoVaTen (họ và tên), noiThuongTru (nơi thường trú). Chỉ trả về JSON array, không có text khác.`
      },
      ...imageDataArray.map((imageData, index) => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData
        }
      }))
    ];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: content
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const responseContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseContent) {
      throw new Error('No content in response');
    }

    try {
      // Try to parse JSON array from response
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsedArray = JSON.parse(jsonMatch[0]);
        
        // Ensure we have an array and it matches the number of images
        if (Array.isArray(parsedArray) && parsedArray.length === imageFiles.length) {
          return parsedArray.map((item, index) => ({
            soCanCuoc: item.soCanCuoc || 'Không xác định',
            hoVaTen: item.hoVaTen || 'Không xác định',
            noiThuongTru: item.noiThuongTru || 'Không xác định',
            rawResponse: JSON.stringify(item)
          }));
        } else {
          // If array length doesn't match, try to extract individual results
          return imageFiles.map((_, index) => {
            const item = parsedArray[index] || {};
            return {
              soCanCuoc: item.soCanCuoc || 'Không xác định',
              hoVaTen: item.hoVaTen || 'Không xác định',
              noiThuongTru: item.noiThuongTru || 'Không xác định',
              rawResponse: JSON.stringify(item)
            };
          });
        }
      } else {
        // Fallback: try to extract information manually for each image
        return imageFiles.map((_, index) => {
          // Try to find patterns for each image in the response
          const soCanCuocMatch = responseContent.match(new RegExp(`ảnh\\s*${index + 1}[^0-9]*([0-9]{12})`, 'i')) ||
                                  responseContent.match(new RegExp(`số\\s*căn\\s*cước[^0-9]*([0-9]{12})`, 'i'));
          const hoVaTenMatch = responseContent.match(new RegExp(`ảnh\\s*${index + 1}[^:]*họ\\s*và\\s*tên[^\\n]*:([^\\n,]+)`, 'i')) ||
                               responseContent.match(new RegExp(`họ\\s*và\\s*tên[^:]*:([^\\n,]+)`, 'i'));
          const noiThuongTruMatch = responseContent.match(new RegExp(`ảnh\\s*${index + 1}[^:]*nơi\\s*thường\\s*trú[^\\n]*:([^\\n,]+)`, 'i')) ||
                                    responseContent.match(new RegExp(`nơi\\s*thường\\s*trú[^:]*:([^\\n,]+)`, 'i'));
          
          return {
            soCanCuoc: soCanCuocMatch?.[1] || 'Không xác định',
            hoVaTen: hoVaTenMatch?.[1] || 'Không xác định',
            noiThuongTru: noiThuongTruMatch?.[1] || 'Không xác định',
            rawResponse: responseContent
          };
        });
      }
    } catch (parseError) {
      // If JSON parsing fails, return default results
      return imageFiles.map(() => ({
        soCanCuoc: 'Không xác định',
        hoVaTen: 'Không xác định',
        noiThuongTru: 'Không xác định',
        rawResponse: responseContent
      }));
    }
  };

  const processBatch = async (batchImages: File[]) => {
    // Update all images in batch to processing status
    setProcessedImages(prev => prev.map(img => 
      batchImages.some(batchImg => batchImg.name === img.fileName)
        ? { ...img, status: 'processing' as const }
        : img
    ));

    try {
      // Process all images in batch with single API call
      const results = await processImagesWithGemini(batchImages);
      
      // Update all images with results
      setProcessedImages(prev => prev.map(img => {
        const batchIndex = batchImages.findIndex(batchImg => batchImg.name === img.fileName);
        if (batchIndex !== -1 && results[batchIndex]) {
          return { ...img, status: 'completed' as const, result: results[batchIndex] };
        }
        return img;
      }));
    } catch (error) {
      // Update all images in batch to error status
      setProcessedImages(prev => prev.map(img => 
        batchImages.some(batchImg => batchImg.name === img.fileName)
          ? { ...img, status: 'error' as const, error: error instanceof Error ? error.message : 'Unknown error' }
          : img
      ));
    }
  };

  const startProcessing = async () => {
    if (!googleApiKey) {
      alert('Vui lòng nhập Google AI Studio API Key!');
      return;
    }

    if (images.length === 0) {
      alert('Vui lòng chọn ảnh để xử lý!');
      return;
    }

    setIsProcessing(true);
    setCurrentBatch(0);

    // Initialize processed images
    const initialProcessedImages: ProcessedImage[] = images.map(image => ({
      id: `${image.name}-${Date.now()}`,
      fileName: image.name,
      status: 'pending'
    }));
    setProcessedImages(initialProcessedImages);

    const batches = [];
    for (let i = 0; i < images.length; i += batchConfig.batchSize) {
      batches.push(images.slice(i, i + batchConfig.batchSize));
    }

    setTotalBatches(batches.length);

    for (let i = 0; i < batches.length; i++) {
      setCurrentBatch(i + 1);
      await processBatch(batches[i]);
      
      // Delay between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, batchConfig.delayBetweenBatches));
      }
    }

    setIsProcessing(false);
  };

  const exportToExcel = () => {
    const completedImages = processedImages.filter(img => img.status === 'completed' && img.result);
    
    if (completedImages.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }

    const data = completedImages.map(img => ({
      'Họ và tên': img.result?.hoVaTen || 'Không xác định',
      'Số căn cước công dân': img.result?.soCanCuoc || '',
      'Nơi thường trú': img.result?.noiThuongTru || '',
      'Format định dạng': (img.result?.noiThuongTru || '').replace(/,/g, ' - ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kết quả xử lý ảnh');
    
    // Auto-size columns
    const colWidths = [
      { wch: 40 }, // Họ và tên
      { wch: 25 }, // Số căn cước
      { wch: 50 }, // Nơi thường trú
      { wch: 60 }  // Format định dạng
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `ket_qua_xu_ly_anh_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const clearAll = () => {
    setImages([]);
    setProcessedImages([]);
    setCurrentBatch(0);
    setTotalBatches(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (fileName: string) => {
    setImages(prev => prev.filter(img => img.name !== fileName));
    setProcessedImages(prev => prev.filter(img => img.fileName !== fileName));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Xử lý ảnh căn cước công dân</h3>
          <p className="text-gray-600 mt-2">Upload ảnh và sử dụng Gemini API để trích xuất thông tin</p>
        </div>

        <div className="p-6 space-y-6">
          {/* API Configuration */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google AI Studio API Key *
              </label>
              <input
                type="password"
                value={googleApiKey}
                onChange={(e) => setGoogleApiKey(e.target.value)}
                placeholder="Nhập API key từ Google AI Studio"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lấy API key từ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>
              </p>
            </div>
          </div>

          {/* Batch Configuration */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Cấu hình xử lý theo lô</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Số ảnh mỗi lô</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={batchConfig.batchSize}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= 1 && value <= 20) {
                      setBatchConfig(prev => ({ ...prev, batchSize: value }));
                      console.log('🔄 Updated batchSize:', value);
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value);
                    if (isNaN(value) || value < 1 || value > 20) {
                      setBatchConfig(prev => ({ ...prev, batchSize: 10 }));
                      console.log('🔄 Reset batchSize to default: 10');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tất cả ảnh trong lô sẽ được xử lý cùng lúc
                </p>
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  Giá trị hiện tại: {batchConfig.batchSize} ảnh/lô
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Delay giữa các lô (ms)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={batchConfig.delayBetweenBatches}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= 0) {
                      setBatchConfig(prev => ({ ...prev, delayBetweenBatches: value }));
                      console.log('🔄 Updated delayBetweenBatches:', value);
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value);
                    if (isNaN(value) || value < 0) {
                      setBatchConfig(prev => ({ ...prev, delayBetweenBatches: 2000 }));
                      console.log('🔄 Reset delayBetweenBatches to default: 2000');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Thời gian chờ giữa các lô để tránh rate limit
                </p>
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  Giá trị hiện tại: {batchConfig.delayBetweenBatches}ms
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <button
                onClick={() => {
                  setBatchConfig({
                    batchSize: 10,
                    delayBetweenBatches: 2000,
                    delayBetweenImages: 0
                  });
                  console.log('🔄 Reset batchConfig to defaults');
                }}
                className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
              >
                Reset về mặc định
              </button>
            </div>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-blue-600 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Tối ưu hóa hiệu suất:</p>
                  <p>• Mỗi lô sẽ gửi tất cả ảnh trong một lần call API</p>
                  <p>• Giảm số lượng API calls từ {batchConfig.batchSize} xuống 1</p>
                  <p>• Tiết kiệm thời gian và chi phí xử lý</p>
                </div>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn ảnh (tối đa 50 ảnh)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Chọn ảnh
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Hỗ trợ: JPEG, PNG, WebP. Tối đa 50 ảnh.
              </p>
            </div>
          </div>

          {/* Selected Images */}
          {images.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-gray-900">
                  Đã chọn {images.length} ảnh
                </h4>
                <button
                  onClick={clearAll}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Xóa tất cả
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={image.name}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <button
                        onClick={() => removeImage(image.name)}
                        className="text-white hover:text-red-400 transition-colors"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 truncate" title={image.name}>
                      {image.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={startProcessing}
              disabled={isProcessing || images.length === 0 || !googleApiKey}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang xử lý...
                </span>
              ) : (
                'Bắt đầu xử lý'
              )}
            </button>
            
            {processedImages.length > 0 && (
              <button
                onClick={exportToExcel}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Xuất Excel
              </button>
            )}
          </div>

          {/* Processing Progress */}
          {isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  Đang xử lý lô {currentBatch}/{totalBatches}
                </span>
                <span className="text-sm text-blue-700">
                  {Math.round((currentBatch / totalBatches) * 100)}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentBatch / totalBatches) * 100}%` }}
                ></div>
              </div>
              <div className="mt-2 text-xs text-blue-700">
                <p>• Lô {currentBatch}: Xử lý {batchConfig.batchSize} ảnh cùng lúc</p>
                <p>• Tiết kiệm: {batchConfig.batchSize} API calls → 1 API call</p>
                <p>• Thời gian chờ giữa các lô: {batchConfig.delayBetweenBatches}ms</p>
              </div>
            </div>
          )}

          {/* Results */}
          {processedImages.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Kết quả xử lý ({processedImages.filter(img => img.status === 'completed').length}/{processedImages.length})
              </h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {processedImages.map((image) => (
                  <div
                    key={image.id}
                    className={`p-4 rounded-lg border ${
                      image.status === 'completed'
                        ? 'border-green-200 bg-green-50'
                        : image.status === 'error'
                        ? 'border-red-200 bg-red-50'
                        : image.status === 'processing'
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 mb-2">{image.fileName}</h5>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            image.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : image.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : image.status === 'processing'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {image.status === 'completed' && 'Hoàn thành'}
                            {image.status === 'error' && 'Lỗi'}
                            {image.status === 'processing' && 'Đang xử lý'}
                            {image.status === 'pending' && 'Chờ xử lý'}
                          </span>
                        </div>
                        
                        {image.status === 'completed' && image.result && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Số căn cước:</span>
                              <span className="ml-2 text-gray-900">{image.result.soCanCuoc}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Họ và tên:</span>
                              <span className="ml-2 text-gray-900">{image.result.hoVaTen}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Nơi thường trú:</span>
                              <span className="ml-2 text-gray-900">{image.result.noiThuongTru}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Format định dạng:</span>
                              <span className="ml-2 text-gray-900">{(image.result.noiThuongTru || '').replace(/,/g, ' - ')}</span>
                            </div>
                          </div>
                        )}
                        
                        {image.status === 'error' && image.error && (
                          <div className="text-sm text-red-600">
                            Lỗi: {image.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
