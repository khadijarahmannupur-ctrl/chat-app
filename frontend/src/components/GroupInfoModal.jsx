"use client";

import { useState, useEffect } from "react";
import { FiX, FiUsers, FiUserPlus, FiUserMinus, FiShield, FiSearch, FiCheck } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

export default function GroupInfoModal({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onMembersUpdated,
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = details && details.adminId === currentUserId;

  const fetchGroupDetails = async () => {
    if (!conversation?.id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/conversations/${conversation.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
      }
    } catch (err) {
      console.error("Fetch group details error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && conversation?.id) {
      fetchGroupDetails();
      setIsAdding(false);
      setSearchQuery("");
      setSelectedToAdd([]);
      setError("");
    }
  }, [isOpen, conversation?.id]);

  // Search users to add
  useEffect(() => {
    if (!isAdding) return;
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length === 0) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await apiFetch(`${BACKEND_URL}/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out users already in the group
          const existingIds = new Set(details?.members || []);
          setSearchResults(data.filter((u) => !existingIds.has(u.id)));
        }
      } catch (err) {
        console.error("Search error:", err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isAdding, details]);

  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/conversations/${conversation.id}/members/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: selectedToAdd.map((u) => u.id) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add members");
      }
      setIsAdding(false);
      setSelectedToAdd([]);
      setSearchQuery("");
      await fetchGroupDetails();
      if (onMembersUpdated) onMembersUpdated();
    } catch (err) {
      setError(err.message || "Failed to add members");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/conversations/${conversation.id}/members/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      await fetchGroupDetails();
      if (onMembersUpdated) onMembersUpdated();
    } catch (err) {
      setError(err.message || "Failed to remove member");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen || !conversation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09251C]/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#F8EADC] border-2 border-[#09251C] rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-[#09251C]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#09251C]/15 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#09251C] text-[#F8EADC] flex items-center justify-center">
              <FiUsers className="text-base" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">{conversation.name}</h3>
              <p className="text-[11px] text-[#09251C]/60">
                {details?.members?.length || 0} members
              </p>
            </div>
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

        {/* Admin action: Add members button toggle */}
        {isAdmin && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#09251C]/80">Group Management</span>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#A55704] text-[#F8EADC] text-xs font-semibold rounded-lg hover:bg-[#8e4a03] transition shadow-sm"
            >
              <FiUserPlus className="text-sm" />
              <span>{isAdding ? "View Members" : "Add Members"}</span>
            </button>
          </div>
        )}

        {/* Mode: Adding new members */}
        {isAdding ? (
          <div className="flex flex-col gap-3">
            <div className="relative flex items-center">
              <FiSearch className="absolute left-3 text-[#09251C]/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user to add..."
                className="w-full pl-9 pr-3 py-2 bg-white/70 border border-[#09251C]/20 rounded-xl text-sm focus:outline-none focus:border-[#A55704]"
              />
            </div>

            {selectedToAdd.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedToAdd.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#09251C] text-[#F8EADC] text-xs rounded-full"
                  >
                    {u.name}
                    <button
                      onClick={() => setSelectedToAdd(selectedToAdd.filter((x) => x.id !== u.id))}
                    >
                      <FiX className="text-xs" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="max-h-48 overflow-y-auto rounded-xl border border-[#09251C]/15 bg-white/50 divide-y divide-[#09251C]/10">
              {searchResults.length === 0 ? (
                <div className="p-3 text-center text-xs text-[#09251C]/50">
                  {searchQuery ? "No matching users found" : "Type to search users"}
                </div>
              ) : (
                searchResults.map((user) => {
                  const isSelected = selectedToAdd.some((u) => u.id === user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedToAdd(selectedToAdd.filter((u) => u.id !== user.id));
                        } else {
                          setSelectedToAdd([...selectedToAdd, user]);
                        }
                      }}
                      className="flex items-center justify-between p-2 cursor-pointer hover:bg-[#09251C]/5 transition"
                    >
                      <div className="flex items-center gap-2">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#A55704] text-[#F8EADC] flex items-center justify-center font-bold text-xs">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-semibold">{user.name}</div>
                          <div className="text-[10px] text-[#09251C]/60">{user.email}</div>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                          isSelected
                            ? "bg-[#09251C] text-[#F8EADC] border-[#09251C]"
                            : "border-[#09251C]/30 bg-white"
                        }`}
                      >
                        {isSelected && <FiCheck />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={handleAddMembers}
              disabled={actionLoading || selectedToAdd.length === 0}
              className="w-full py-2 bg-[#A55704] hover:bg-[#8e4a03] text-[#F8EADC] text-xs font-semibold rounded-xl transition disabled:opacity-50"
            >
              {actionLoading ? "Adding..." : `Add Selected (${selectedToAdd.length})`}
            </button>
          </div>
        ) : (
          /* Mode: Member List */
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-[#09251C]/70">Group Members</div>
            <div className="max-h-60 overflow-y-auto rounded-xl border border-[#09251C]/15 bg-white/40 divide-y divide-[#09251C]/10">
              {loading ? (
                <div className="p-4 text-center text-xs text-[#09251C]/60">Loading members...</div>
              ) : (
                details?.memberDetails?.map((member) => {
                  const isMemberAdmin = member.id === details.adminId;
                  const isSelf = member.id === currentUserId;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2.5 hover:bg-[#09251C]/5 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {member.image ? (
                          <img
                            src={member.image}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#09251C] text-[#F8EADC] flex items-center justify-center font-bold text-xs shrink-0">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                            <span>{member.name}</span>
                            {isSelf && (
                              <span className="text-[10px] text-[#A55704] font-medium">(You)</span>
                            )}
                            {isMemberAdmin && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#A55704] bg-[#A55704]/10 px-1.5 py-0.2 rounded">
                                <FiShield className="text-[10px]" /> Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#09251C]/60 truncate">
                            {member.email}
                          </div>
                        </div>
                      </div>

                      {/* Admin remove button */}
                      {isAdmin && !isMemberAdmin && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={actionLoading}
                          title="Remove member"
                          className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg transition"
                        >
                          <FiUserMinus className="text-sm" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-[#09251C]/15 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#09251C]/10 hover:bg-[#09251C]/20 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
