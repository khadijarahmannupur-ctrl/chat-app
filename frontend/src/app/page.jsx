"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { io } from "socket.io-client";
import AuthModal from "@/components/AuthModal";
import ChatSidebar from "@/components/ChatSidebar";
import ChatArea from "@/components/ChatArea";
import CreateGroupModal from "@/components/CreateGroupModal";
import GroupInfoModal from "@/components/GroupInfoModal";
import { FiMessageSquare } from "react-icons/fi";

const BACKEND_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

export default function Home() {
  const { data: sessionData, isPending } = useSession();
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const socketRef = useRef(null);

  // Sync user from session
  useEffect(() => {
    if (sessionData?.user) {
      setCurrentUser(sessionData.user);
    } else {
      setCurrentUser(null);
      setActiveChat(null);
      setConversations([]);
      setMessages([]);
    }
  }, [sessionData]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Fetch conversations error:", err);
    }
  }, [currentUser]);

  // Fetch message history for active chat
  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/${convId}/messages`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        // Mark as read in state
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (err) {
      console.error("Fetch messages error:", err);
    }
  }, []);

  // Initialize Socket.io connection when logged in
  useEffect(() => {
    if (!currentUser) return;

    fetchConversations();

    const socket = io(BACKEND_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to real-time socket");
    });

    // Handle new incoming messages
    socket.on("new_message", (message) => {
      // Check if message belongs to active chat
      setActiveChat((currentActive) => {
        if (currentActive && currentActive.id === message.conversationId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message];
          });
          // Notify server read
          socket.emit("mark_read", { conversationId: message.conversationId });
        } else {
          // Increment unread count for that conversation
          setConversations((prev) =>
            prev.map((c) =>
              c.id === message.conversationId
                ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
                : c
            )
          );
        }
        return currentActive;
      });

      // Update lastMessage preview in conversations list
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === message.conversationId) {
            return {
              ...c,
              updatedAt: message.createdAt,
              lastMessage: {
                text: message.text,
                hasAttachment: !!message.attachment,
                attachmentType: message.attachment?.type || null,
                createdAt: message.createdAt,
              },
            };
          }
          return c;
        })
      );
    });

    // Handle conversation preview update
    socket.on("conversation_preview_update", (data) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === data.conversationId
            ? {
                ...c,
                updatedAt: data.updatedAt,
                lastMessage: data.lastMessage,
              }
            : c
        )
      );
    });

    // Handle new conversation creation
    socket.on("conversation_created", (newConv) => {
      setConversations((prev) => {
        if (prev.some((c) => c.id === newConv.id)) return prev;
        return [newConv, ...prev];
      });
    });

    // Handle group member updates
    socket.on("group_members_updated", (data) => {
      if (data.removedMemberId === currentUser.id) {
        // Current user was removed from group
        setConversations((prev) => prev.filter((c) => c.id !== data.conversationId));
        setActiveChat((currentActive) =>
          currentActive?.id === data.conversationId ? null : currentActive
        );
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === data.conversationId ? { ...c, members: data.members } : c
          )
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser, fetchConversations]);

  // Select a chat
  const handleSelectChat = (conv) => {
    setActiveChat(conv);
    fetchMessages(conv.id);
    if (socketRef.current) {
      socketRef.current.emit("mark_read", { conversationId: conv.id });
    }
  };

  // Start or open direct 1-to-1 chat
  const handleStartDirectChat = async (recipientId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientId }),
      });
      if (res.ok) {
        const conv = await res.json();
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === conv.id);
          if (exists) return prev;
          return [conv, ...prev];
        });
        handleSelectChat(conv);
      }
    } catch (err) {
      console.error("Direct chat error:", err);
    }
  };

  // Send message via Socket.io
  const handleSendMessage = ({ conversationId, text, attachment }) => {
    if (!socketRef.current) return;
    socketRef.current.emit("send_message", {
      conversationId,
      text,
      attachment,
    });
  };

  // If session is loading
  if (isPending) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8EADC] text-[#09251C]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#A55704] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wide">Loading workspace...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, show AuthModal
  if (!currentUser) {
    return (
      <div className="h-screen w-screen bg-[#F8EADC] relative overflow-hidden flex items-center justify-center">
        <AuthModal onAuthSuccess={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <main className="h-screen w-screen flex bg-[#F8EADC] text-[#09251C] overflow-hidden">
      {/* Sidebar: On mobile, visible when activeChat is null; on desktop, fixed width */}
      <div
        className={`h-full w-full md:w-80 lg:w-96 shrink-0 transition-all ${
          activeChat ? "hidden md:flex" : "flex"
        }`}
      >
        <ChatSidebar
          currentUser={currentUser}
          conversations={conversations}
          activeChat={activeChat}
          onSelectChat={handleSelectChat}
          onOpenNewGroup={() => setIsGroupModalOpen(true)}
          onStartDirectChat={handleStartDirectChat}
          onLogout={() => setCurrentUser(null)}
        />
      </div>

      {/* Chat Area: On mobile, visible when activeChat is set; on desktop, takes remaining space */}
      <div
        className={`h-full flex-1 min-w-0 flex-col ${
          activeChat ? "flex" : "hidden md:flex"
        }`}
      >
        {activeChat ? (
          <ChatArea
            conversation={activeChat}
            messages={messages}
            onSendMessage={handleSendMessage}
            onBack={() => setActiveChat(null)}
            onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
            currentUserId={currentUser.id}
          />
        ) : (
          /* Desktop empty placeholder state */
          <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center chat-nature-bg">
            <div className="w-16 h-16 rounded-2xl bg-[#09251C] text-[#F8EADC] flex items-center justify-center mb-4 shadow-lg">
              <FiMessageSquare className="text-3xl text-[#A55704]" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[#09251C]">
              Welcome, {currentUser.name}
            </h2>
            <p className="text-xs sm:text-sm text-[#09251C]/70 max-w-sm mt-1 mb-4 leading-relaxed">
              Select a conversation from the sidebar, search for people to start a 1-on-1 chat, or create an anonymous group.
            </p>
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className="px-4 py-2 bg-[#A55704] text-[#F8EADC] text-xs font-semibold rounded-xl hover:bg-[#8e4a03] transition shadow"
            >
              Start New Group
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onGroupCreated={(newGroup) => {
          setConversations((prev) => [newGroup, ...prev]);
          handleSelectChat(newGroup);
        }}
      />

      <GroupInfoModal
        isOpen={isGroupInfoOpen}
        onClose={() => setIsGroupInfoOpen(false)}
        conversation={activeChat}
        currentUserId={currentUser.id}
        onMembersUpdated={fetchConversations}
      />
    </main>
  );
}
