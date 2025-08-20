'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, DocumentTextIcon, VariableIcon } from '@heroicons/react/24/outline';
import { Modal } from 'antd';

interface Template {
  _id: string;
  name: string;
  content: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
}

interface TemplateManagerProps {
  accessToken: string;
  onTemplateSelect?: (template: Template) => void;
}

export default function TemplateManager({ accessToken, onTemplateSelect }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    content: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewContent, setPreviewContent] = useState('');

  useEffect(() => {
    setMounted(true);
    fetchTemplates();
  }, []);

  // Tự động phát hiện biến khi content thay đổi
  useEffect(() => {
    const variableRegex = /\b(xxx|yyy|sdt|ttt|zzz|www|uuu|vvv)\b/g;
    const variables = [...new Set(formData.content.match(variableRegex) || [])];
    
    let preview = formData.content;
    variables.forEach(variable => {
      const regex = new RegExp(`\\b${variable}\\b`, 'g');
      preview = preview.replace(regex, `**${variable}**`);
    });
    
    setPreviewContent(preview);
  }, [formData.content]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/template', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = '/api/template';
      const method = editingTemplate ? 'PUT' : 'POST';
      const payload = editingTemplate 
        ? { ...formData, id: editingTemplate._id }
        : formData;

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setShowForm(false);
        setEditingTemplate(null);
        setFormData({ name: '', content: '' });
        setPreviewContent('');
        fetchTemplates();
      } else {
        setError(data.error || 'Có lỗi xảy ra');
      }
    } catch (error: any) {
      setError('Không thể kết nối đến server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      content: template.content
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa template này?')) return;

    try {
      const response = await fetch(`/api/template?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        setSuccess('Xóa template thành công');
        fetchTemplates();
      } else {
        const data = await response.json();
        setError(data.error || 'Không thể xóa template');
      }
    } catch (error) {
      setError('Không thể kết nối đến server');
    }
  };

  const handleTemplateSelect = (template: Template) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
    setFormData({ name: '', content: '' });
    setPreviewContent('');
    setError('');
    setSuccess('');
  };

  if (!mounted) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Quản lý Template</h1>
        <p className="text-gray-600">Tạo và quản lý các mẫu tin nhắn với biến thay thế</p>
        
        {/* Variables Guide */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Các biến có thể sử dụng:</h3>
          <div className="flex flex-wrap gap-2">
            {['xxx', 'yyy', 'sdt', 'ttt', 'zzz', 'www', 'uuu', 'vvv'].map(variable => (
              <span key={variable} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md font-mono">
                {variable}
              </span>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Các biến sẽ được tự động phát hiện và highlight trong preview
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Add New Template Button */}
      {!showForm && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Thêm template mới
          </button>
        </div>
      )}

      {/* Template Modal */}
      <Modal
        title={editingTemplate ? 'Chỉnh sửa template' : 'Thêm template mới'}
        open={showForm}
        onCancel={resetForm}
        footer={null}
        width={600}
        destroyOnClose
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tên template <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ví dụ: Chào hỏi khách hàng"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nội dung template <span className="text-red-500">*</span>
            </label>
            <textarea
              name="content"
              required
              rows={6}
              value={formData.content}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nhập nội dung template. Sử dụng các biến như xxx, yyy, sdt... Ví dụ: Xin chào xxx, chúc yyy một ngày tốt lành!"
            />
            
            {/* Preview */}
            {previewContent && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center mb-2">
                  <VariableIcon className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Preview:</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {previewContent}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Đang xử lý...' : (editingTemplate ? 'Cập nhật' : 'Thêm mới')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Templates List */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Danh sách template</h3>
        </div>

        {templates.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p>Chưa có template nào. Hãy tạo template đầu tiên!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {templates.map((template) => (
              <div key={template._id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-900">{template.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        template.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {template.isActive ? 'Hoạt động' : 'Không hoạt động'}
                      </span>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {template.content}
                      </p>
                    </div>

                    {/* Variables */}
                    {template.variables.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center mb-2">
                          <VariableIcon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm font-medium text-gray-700">Biến:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {template.variables.map(variable => (
                            <span key={variable} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md font-mono">
                              {variable}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      Ngày tạo: {new Date(template.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {/* Select Button */}
                    {onTemplateSelect && (
                      <button
                        onClick={() => handleTemplateSelect(template)}
                        className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center"
                        title="Sử dụng template này"
                      >
                        <DocumentTextIcon className="h-4 w-4 mr-1" />
                        Sử dụng
                      </button>
                    )}

                    {/* Edit Button */}
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Chỉnh sửa"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(template._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
