"use client";

import { useState, useEffect } from "react";
import {
  FiSearch,
  FiUsers,
  FiUser,
  FiPlus,
  FiLogOut,
  FiMessageSquare,
  FiPaperclip,
} from "react-icons/fi";
import { signOut } from "@/lib/auth-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

export default function ChatSidebar({
  currentUser,
  conversations,
  activeChat,
  onSelectChat,
  onOpenNewGroup,
  onStartDirectChat,
  onLogout,
}) {
  const [searchMode, setSearchMode] = useState("people"); // "people" | "groups"
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Search people via backend API
  useEffect(() => {
    if (searchMode !== "people" || searchQuery.trim().length === 0) {
      setUserSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          setUserSearchResults(data);
        }
      } catch (err) {
        console.error("Search users error:", err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode]);

  // Filter groups locally by search query
  const filteredConversations = conversations.filter((c) => {
    if (searchMode === "groups") {
      if (c.type !== "group") return false;
      if (!searchQuery.trim()) return true;
      return c.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const handleLogout = async () => {
    try {
      await signOut();
      if (onLogout) onLogout();
      window.location.reload();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#F8EADC] border-r border-[#09251C]/20 select-none">
      {/* User profile header */}
      <div className="p-3 sm:p-4 bg-[#09251C] text-[#F8EADC] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          {currentUser?.image ? (
            <img
              src={currentUser.image}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-[#A55704] shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#A55704] text-[#F8EADC] flex items-center justify-center font-bold text-sm shrink-0">
              {currentUser?.name?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-bold text-sm truncate leading-tight">
              {currentUser?.name || "User"}
            </h2>
            <p className="text-[11px] text-[#F8EADC]/70 truncate">
              {currentUser?.email || ""}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          className="p-2 rounded-xl text-[#F8EADC]/80 hover:text-[#F8EADC] hover:bg-[#F8EADC]/10 transition"
        >
          <FiLogOut className="text-lg" />
        </button>
      </div>

      {/* Search selector toggle & Input */}
      <div className="p-3 border-b border-[#09251C]/15 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex bg-[#09251C]/10 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => {
                setSearchMode("people");
                setSearchQuery("");
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition ${
                searchMode === "people"
                  ? "bg-[#09251C] text-[#F8EADC] shadow-sm"
                  : "text-[#09251C]/70 hover:text-[#09251C]"
              }`}
            >
              <FiUser className="text-xs" />
              <span>People</span>
            </button>
            <button
              onClick={() => {
                setSearchMode("groups");
                setSearchQuery("");
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition ${
                searchMode === "groups"
                  ? "bg-[#09251C] text-[#F8EADC] shadow-sm"
                  : "text-[#09251C]/70 hover:text-[#09251C]"
              }`}
            >
              <FiUsers className="text-xs" />
              <span>Groups</span>
            </button>
          </div>

          {/* New Group button */}
          <button
            onClick={onOpenNewGroup}
            title="Create Group"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#A55704] text-[#F8EADC] hover:bg-[#8e4a03] rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <FiPlus className="text-sm" />
            <span className="hidden sm:inline">New Group</span>
          </button>
        </div>

        {/* Search input field */}
        <div className="relative flex items-center">
          <FiSearch className="absolute left-3 text-[#09251C]/50 text-sm" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              searchMode === "people"
                ? "Search people by name or email..."
                : "Search my groups..."
            }
            className="w-full pl-9 pr-3 py-2 bg-white/70 border border-[#09251C]/20 rounded-xl text-xs sm:text-sm text-[#09251C] placeholder-[#09251C]/50 focus:outline-none focus:border-[#A55704]"
          />
        </div>
      </div>

      {/* Main chat list or search results */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#09251C]/10">
        {/* People Search Results */}
        {searchMode === "people" && searchQuery.trim().length > 0 ? (
          <div>
            <div className="p-2 text-[11px] font-bold uppercase tracking-wider text-[#09251C]/60 bg-[#09251C]/5">
              People Results
            </div>
            {searching ? (
              <div className="p-4 text-center text-xs text-[#09251C]/60">Searching...</div>
            ) : userSearchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#09251C]/60">
                No users found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              userSearchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => {
                    onStartDirectChat(user.id);
                    setSearchQuery("");
                  }}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[#09251C]/5 transition"
                >
                  {user.image ? (
                    <img
                      src={user.image}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#A55704] text-[#F8EADC] flex items-center justify-center font-bold text-xs shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#09251C] truncate">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-[#09251C]/60 truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#09251C]/60 flex flex-col items-center gap-2">
            <FiMessageSquare className="text-3xl text-[#09251C]/30" />
            <span>
              {searchMode === "groups" && searchQuery
                ? "No matching groups found"
                : "No conversations yet. Search people above or start a new group!"}
            </span>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = activeChat?.id === conv.id;
            const isGroup = conv.type === "group";

            return (
              <div
                key={conv.id}
                onClick={() => onSelectChat(conv)}
                className={`flex items-center gap-3 p-3 cursor-pointer transition ${
                  isActive
                    ? "bg-[#09251C] text-[#F8EADC]"
                    : "hover:bg-[#09251C]/5 text-[#09251C]"
                }`}
              >
                {/* Avatar / Group Badge */}
                {isGroup ? (
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-[#A55704] text-[#F8EADC]"
                        : "bg-[#09251C] text-[#F8EADC]"
                    }`}
                  >
                    <FiUsers className="text-base" />
                  </div>
                ) : conv.image ? (
                  <img
                    src={conv.image}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#09251C]/20"
                  />
                ) : (
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      isActive
                        ? "bg-[#A55704] text-[#F8EADC]"
                        : "bg-[#A55704]/90 text-[#F8EADC]"
                    }`}
                  >
                    {conv.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-semibold text-xs sm:text-sm truncate">
                      {conv.name}
                    </span>
                    <span
                      className={`text-[10px] shrink-0 ${
                        isActive ? "text-[#F8EADC]/70" : "text-[#09251C]/60"
                      }`}
                    >
                      {formatTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    {/* Last message preview - HIDDEN SENDER: No sender name in group preview! */}
                    <p
                      className={`text-[11px] truncate ${
                        isActive ? "text-[#F8EADC]/80" : "text-[#09251C]/70"
                      }`}
                    >
                      {conv.lastMessage ? (
                        conv.lastMessage.hasAttachment ? (
                          <span className="inline-flex items-center gap-1 italic">
                            <FiPaperclip className="text-[10px]" />
                            {conv.lastMessage.text || "Attachment"}
                          </span>
                        ) : (
                          conv.lastMessage.text || "No messages yet"
                        )
                      ) : (
                        <span className="italic">No messages yet</span>
                      )}
                    </p>

                    {/* Unread count badge */}
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 bg-[#A55704] text-[#F8EADC] text-[10px] font-bold rounded-full min-w-4 text-center shadow-sm">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
