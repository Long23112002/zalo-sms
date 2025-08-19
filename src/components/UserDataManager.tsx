'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  message, 
  Upload, 
  Space, 
  Popconfirm,
  Select,
  Card,
  Typography,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  UploadOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  EyeOutlined,
  DownloadOutlined,
  GoogleOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const { Title, Text } = Typography;
const { Option } = Select;

interface UserData {
  _id: string;
  phone: string;
  xxx?: string;
  yyy?: string;
  sdt?: string;
  ttt?: string;
  zzz?: string;
  www?: string;
  uuu?: string;
  vvv?: string;
  customFields?: Record<string, string>;
  createdAt: string;
}

interface Template {
  _id: string;
  name: string;
  content: string;
  variables: string[];
}

interface UserDataManagerProps {
  accessToken: string;
  onPhoneClick?: (phone: string, data: UserData) => void;
}

export default function UserDataManager({ accessToken, onPhoneClick }: UserDataManagerProps) {
  const [userDataList, setUserDataList] = useState<UserData[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingData, setEditingData] = useState<UserData | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchUserData();
    fetchTemplates();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user-data', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserDataList(data.userDataList);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      message.error('Không thể tải dữ liệu');
    }
  };

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

  const handleAdd = () => {
    setEditingData(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: UserData) => {
    setEditingData(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/user-data?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        message.success('Xóa thành công');
        fetchUserData();
      } else {
        message.error('Không thể xóa');
      }
    } catch (error) {
      message.error('Lỗi xảy ra');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      const endpoint = '/api/user-data';
      const method = editingData ? 'PUT' : 'POST';
      const payload = editingData 
        ? { ...values, id: editingData._id }
        : { dataList: [values] };

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        message.success(editingData ? 'Cập nhật thành công' : 'Thêm thành công');
        setModalVisible(false);
        fetchUserData();
      } else {
        const data = await response.json();
        message.error(data.error || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Form error:', error);
    }
  };

  const handlePhoneClick = (phone: string, data: UserData) => {
    setSelectedPhone(phone);
    setPreviewModalVisible(true);
    if (onPhoneClick) {
      onPhoneClick(phone, data);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t._id === templateId);
    if (template) {
      const data = userDataList.find(d => d.phone === selectedPhone);
      if (data) {
        let content = template.content;
        const variables = ['xxx', 'yyy', 'sdt', 'ttt', 'zzz', 'www', 'uuu', 'vvv'];
        variables.forEach(variable => {
          const raw: any = (data as any)[variable];
          const value: string = typeof raw === 'string' ? raw : '';
          const regex = new RegExp(`\\b${variable}\\b`, 'g');
          content = content.replace(regex, value);
        });
        setPreviewContent(content);
      }
    }
  };

  const handleExcelImport = async (file: File) => {
    try {
      const data = await readExcelFile(file);
      await importData(data);
      message.success('Import Excel thành công');
    } catch (error) {
      message.error('Lỗi import Excel');
    }
    return false; // Prevent default upload
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const importData = async (dataList: any[]) => {
    try {
      const response = await fetch('/api/user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ dataList })
      });

      if (response.ok) {
        const result = await response.json();
        message.success(result.message);
        fetchUserData();
      } else {
        const error = await response.json();
        message.error(error.error || 'Lỗi import dữ liệu');
      }
    } catch (error) {
      message.error('Không thể kết nối server');
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(userDataList);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'UserData');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, 'user-data.xlsx');
  };

  const columns = [
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string, record: UserData) => (
        <Button 
          type="link" 
          onClick={() => handlePhoneClick(phone, record)}
          style={{ padding: 0, height: 'auto' }}
        >
          {phone}
        </Button>
      )
    },
    { title: 'xxx', dataIndex: 'xxx', key: 'xxx' },
    { title: 'yyy', dataIndex: 'yyy', key: 'yyy' },
    { title: 'sdt', dataIndex: 'sdt', key: 'sdt' },
    { title: 'ttt', dataIndex: 'ttt', key: 'ttt' },
    { title: 'zzz', dataIndex: 'zzz', key: 'zzz' },
    { title: 'www', dataIndex: 'www', key: 'www' },
    { title: 'uuu', dataIndex: 'uuu', key: 'uuu' },
    { title: 'vvv', dataIndex: 'vvv', key: 'vvv' },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: UserData) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa?"
            onConfirm={() => handleDelete(record._id)}
            okText="Có"
            cancelText="Không"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <Title level={2}>Quản lý dữ liệu người dùng</Title>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAdd}
            >
              Thêm mới
            </Button>
            <Upload
              accept=".xlsx,.xls"
              beforeUpload={handleExcelImport}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>
                Import Excel
              </Button>
            </Upload>
            <Button 
              icon={<GoogleOutlined />}
              onClick={() => message.info('Tính năng Google Sheet đang phát triển')}
            >
              Import Google Sheet
            </Button>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={exportToExcel}
            >
              Export Excel
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={userDataList}
          rowKey="_id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} của ${total} bản ghi`
          }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingData ? 'Chỉnh sửa dữ liệu' : 'Thêm dữ liệu mới'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ customFields: {} }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
            >
              <Input placeholder="Nhập số điện thoại" />
            </Form.Item>
            
            <Form.Item name="xxx" label="xxx">
              <Input placeholder="Giá trị xxx" />
            </Form.Item>
            
            <Form.Item name="yyy" label="yyy">
              <Input placeholder="Giá trị yyy" />
            </Form.Item>
            
            <Form.Item name="sdt" label="sdt">
              <Input placeholder="Giá trị sdt" />
            </Form.Item>
            
            <Form.Item name="ttt" label="ttt">
              <Input placeholder="Giá trị ttt" />
            </Form.Item>
            
            <Form.Item name="zzz" label="zzz">
              <Input placeholder="Giá trị zzz" />
            </Form.Item>
            
            <Form.Item name="www" label="www">
              <Input placeholder="Giá trị www" />
            </Form.Item>
            
            <Form.Item name="uuu" label="uuu">
              <Input placeholder="Giá trị uuu" />
            </Form.Item>
            
            <Form.Item name="vvv" label="vvv">
              <Input placeholder="Giá trị vvv" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title={`Preview template cho số ${selectedPhone}`}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={600}
      >
        <div className="space-y-4">
          <div>
            <Text strong>Chọn template:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Chọn template để preview"
              onChange={handleTemplateChange}
              value={selectedTemplate}
            >
              {templates.map(template => (
                <Option key={template._id} value={template._id}>
                  {template.name}
                </Option>
              ))}
            </Select>
          </div>
          
          {previewContent && (
            <div>
              <Divider />
              <Text strong>Preview:</Text>
              <div className="mt-2 p-3 bg-gray-50 rounded border">
                <Text>{previewContent}</Text>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
