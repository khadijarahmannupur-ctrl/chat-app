"use client";

import { useState, useEffect } from "react";
import { FiX, FiUsers, FiSearch, FiCheck } from "react-icons/fi";

const BACKEND_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUsers([]);
      setError("");
    }
  }, [isOpen]);

  // Search people to add
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length === 0) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Search error:", err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleUserSelection = (user) => {
    if (selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a group name");
      return;
    }
    if (selectedUsers.length === 0) {
      setError("Please select at least one member to add");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          memberIds: selectedUsers.map((u) => u.id),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create group");
      }

      const newGroup = await res.json();
      onGroupCreated(newGroup);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09251C]/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#F8EADC] border-2 border-[#09251C] rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-[#09251C]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#09251C]/15 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#09251C] text-[#F8EADC] flex items-center justify-center">
              <FiUsers className="text-base" />
            </div>
            <h3 className="font-bold text-lg">New Group Chat</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#09251C]/70 hover:text-[#09251C] hover:bg-[#09251C]/10 transition"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-100 border border-red-300 text-red-800 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold mb-1">Group Name</label>
            <input
              type="text"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design Sync, Book Club"
              className="w-full px-3 py-2 bg-white/70 border border-[#09251C]/20 rounded-xl text-sm focus:outline-none focus:border-[#A55704]"
            />
          </div>

          {/* Selected Member Chips */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold mb-1">
                Selected Members ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white/40 rounded-xl border border-[#09251C]/10">
                {selectedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-[#09251C] text-[#F8EADC] text-xs rounded-full font-medium"
                  >
                    {user.name}
                    <button
                      type="button"
                      onClick={() => toggleUserSelection(user)}
                      className="hover:text-[#A55704] transition"
                    >
                      <FiX className="text-xs" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search Members */}
          <div>
            <label className="block text-xs font-semibold mb-1">Add Members</label>
            <div className="relative flex items-center">
              <FiSearch className="absolute left-3 text-[#09251C]/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name or email..."
                className="w-full pl-9 pr-3 py-2 bg-white/70 border border-[#09251C]/20 rounded-xl text-sm focus:outline-none focus:border-[#A55704]"
              />
            </div>
          </div>

          {/* Search Results List */}
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[#09251C]/15 bg-white/50 divide-y divide-[#09251C]/10">
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#09251C]/50">
                {searchQuery ? "No users found" : "Type a name or email to find people"}
              </div>
            ) : (
              searchResults.map((user) => {
                const isSelected = selectedUsers.some((u) => u.id === user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleUserSelection(user)}
                    className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-[#09251C]/5 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#A55704] text-[#F8EADC] flex items-center justify-center font-bold text-xs shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{user.name}</div>
                        <div className="text-[11px] text-[#09251C]/60 truncate">{user.email}</div>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border transition ${
                        isSelected
                          ? "bg-[#09251C] border-[#09251C] text-[#F8EADC]"
                          : "border-[#09251C]/30 bg-white"
                      }`}
                    >
                      {isSelected && <FiCheck className="text-xs" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#09251C]/15">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-[#09251C]/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedUsers.length === 0}
              className="px-5 py-2 bg-[#A55704] hover:bg-[#8e4a03] text-[#F8EADC] text-xs font-semibold rounded-xl transition disabled:opacity-50 shadow"
            >
              {loading ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
