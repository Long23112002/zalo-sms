'use client';

import { useState, useEffect } from 'react';

interface ContactListProps {
  cookie: string;
  imei: string;
  userAgent: string;
  onSelectContacts: (contacts: string[]) => void;
}

interface Friend {
  id: string;
  name: string;
  avatar?: string;
}

interface Group {
  id: string;
  name: string;
  avatar?: string;
}

export default function ContactList({ cookie, imei, userAgent, onSelectContacts }: ContactListProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper function để lấy base URL
  const getApiUrl = (endpoint: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${endpoint}`;
    }
    return endpoint;
  };

  useEffect(() => {
    if (cookie && imei && userAgent && mounted) {
      loadContacts();
    }
  }, [cookie, imei, userAgent, mounted]);

  const loadContacts = async () => {
    setIsLoading(true);
    try {
      // Lấy danh sách bạn bè
      const friendsResponse = await fetch(getApiUrl('/api/zalo/get-friends'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie, imei, userAgent })
      });

      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        setFriends(friendsData.friends || []);
      }

      // Lấy danh sách nhóm
      const groupsResponse = await fetch(getApiUrl('/api/zalo/get-groups'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie, imei, userAgent })
      });

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        setGroups(groupsData.groups || []);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    const allContacts = [...friends.map(f => f.id), ...groups.map(g => g.id)];
    setSelectedContacts(allContacts);
    onSelectContacts(allContacts);
  };

  const handleDeselectAll = () => {
    setSelectedContacts([]);
    onSelectContacts([]);
  };

  if (!mounted) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Danh sách liên hệ</h2>

      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2 rounded-md transition-colors ${
            activeTab === 'friends'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Bạn bè ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 rounded-md transition-colors ${
            activeTab === 'groups'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Nhóm ({groups.length})
        </button>
      </div>

      <div className="mb-4 flex space-x-2">
        <button
          onClick={handleSelectAll}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
        >
          Chọn tất cả
        </button>
        <button
          onClick={handleDeselectAll}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
        >
          Bỏ chọn tất cả
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Đang tải danh sách liên hệ...</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {activeTab === 'friends' ? (
            friends.length > 0 ? (
              friends.map(friend => (
                <div
                  key={friend.id}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(friend.id)}
                    onChange={() => handleContactToggle(friend.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{friend.name}</p>
                    <p className="text-sm text-gray-500">ID: {friend.id}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">Không có bạn bè nào</p>
            )
          ) : (
            groups.length > 0 ? (
              groups.map(group => (
                <div
                  key={group.id}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(group.id)}
                    onChange={() => handleContactToggle(group.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{group.name}</p>
                    <p className="text-sm text-gray-500">ID: {group.id}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">Không có nhóm nào</p>
            )
          )}
        </div>
      )}

      {selectedContacts.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-blue-800 text-sm">
            Đã chọn <strong>{selectedContacts.length}</strong> liên hệ
          </p>
        </div>
      )}
    </div>
  );
}
