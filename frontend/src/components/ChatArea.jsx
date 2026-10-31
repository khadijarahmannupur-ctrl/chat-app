"use client";

import { useState, useEffect, useRef } from "react";
import {
  FiSend,
  FiPaperclip,
  FiArrowLeft,
  FiInfo,
  FiFile,
  FiDownload,
  FiX,
  FiUsers,
  FiCheck,
} from "react-icons/fi";
import { apiFetch } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

export default function ChatArea({
  conversation,
  messages,
  onSendMessage,
  onBack,
  onOpenGroupInfo,
  currentUserId,
}) {
  const [inputText, setInputText] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle attachment selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate 5 MB limit
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File exceeds 5 MB maximum size limit");
      return;
    }

    setUploadError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch(`${BACKEND_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload file");
      }

      const fileData = await res.json();
      setAttachedFile(fileData);
    } catch (err) {
      setUploadError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    if ((!inputText.trim() && !attachedFile) || uploading) return;

    onSendMessage({
      conversationId: conversation.id,
      text: inputText.trim(),
      attachment: attachedFile,
    });

    setInputText("");
    setAttachedFile(null);
    setUploadError("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isGroup = conversation?.type === "group";

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#F8EADC] relative overflow-hidden">
      {/* Chat Header */}
      <div className="h-16 px-4 bg-[#09251C] text-[#F8EADC] flex items-center justify-between shadow z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button on mobile */}
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1.5 rounded-lg text-[#F8EADC]/80 hover:text-[#F8EADC] hover:bg-[#F8EADC]/10 transition"
          >
            <FiArrowLeft className="text-xl" />
          </button>

          {/* Avatar / Group Icon */}
          {isGroup ? (
            <div className="w-10 h-10 rounded-full bg-[#A55704] text-[#F8EADC] flex items-center justify-center shrink-0">
              <FiUsers className="text-lg" />
            </div>
          ) : conversation?.image ? (
            <img
              src={conversation.image}
              alt=""
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#A55704]"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#A55704] text-[#F8EADC] flex items-center justify-center font-bold text-sm shrink-0">
              {conversation?.name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}

          {/* Name & status */}
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-base leading-tight truncate">
              {conversation?.name || "Chat"}
            </h3>
            <p className="text-[11px] text-[#F8EADC]/70 truncate">
              {isGroup
                ? `${conversation?.members?.length || ""} members • Anonymous Chat`
                : "Direct Message"}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {isGroup && (
            <button
              onClick={onOpenGroupInfo}
              title="Group Details & Members"
              className="p-2 rounded-xl text-[#F8EADC]/80 hover:text-[#F8EADC] hover:bg-[#F8EADC]/10 transition"
            >
              <FiInfo className="text-lg" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area with Tree Background Pattern */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 chat-nature-bg flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="m-auto text-center p-6 bg-[#09251C]/5 backdrop-blur-xs rounded-2xl border border-[#09251C]/10 max-w-sm">
            <p className="text-xs sm:text-sm font-semibold text-[#09251C]">
              {isGroup
                ? "This is an anonymous group chat."
                : "No messages yet. Say hello!"}
            </p>
            {isGroup && (
              <p className="text-[11px] text-[#09251C]/65 mt-1">
                All messages here are completely anonymous. No one can see who sent what.
              </p>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.isMine;

            // Direct vs Group messaging styling
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${
                  isMine ? "self-end items-end" : "self-start items-start"
                }`}
              >
                {/* 1-on-1 Chats show sender name for incoming */}
                {!isGroup && !isMine && msg.sender?.name && (
                  <span className="text-[10px] font-semibold text-[#09251C]/70 mb-1 ml-1">
                    {msg.sender.name}
                  </span>
                )}

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm break-words transition ${
                    isGroup
                      ? isMine
                        ? "bg-[#A55704] text-[#F8EADC] rounded-br-xs"
                        : "bg-[#09251C] text-[#F8EADC] rounded-bl-xs"
                      : isMine
                      ? "bg-[#A55704] text-[#F8EADC] rounded-br-xs"
                      : "bg-[#09251C] text-[#F8EADC] rounded-bl-xs"
                  }`}
                >
                  {/* Text content */}
                  {msg.text && (
                    <p className="whitespace-pre-wrap leading-relaxed select-text">
                      {msg.text}
                    </p>
                  )}

                  {/* Attachment content */}
                  {msg.attachment && (
                    <div className="mt-2">
                      {msg.attachment.type?.startsWith("image/") ? (
                        <div className="rounded-lg overflow-hidden border border-white/20 max-w-sm">
                          <img
                            src={msg.attachment.url}
                            alt={msg.attachment.name || "Attachment"}
                            className="w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition"
                            onClick={() => window.open(msg.attachment.url, "_blank")}
                          />
                        </div>
                      ) : (
                        <a
                          href={msg.attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={msg.attachment.name}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-black/20 hover:bg-black/30 border border-white/15 transition group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#F8EADC] text-[#09251C] flex items-center justify-center shrink-0">
                            <FiFile className="text-base" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold truncate group-hover:underline">
                              {msg.attachment.name}
                            </div>
                            <div className="text-[10px] opacity-70">
                              {formatFileSize(msg.attachment.size)}
                            </div>
                          </div>
                          <FiDownload className="text-sm shrink-0 opacity-80 group-hover:opacity-100" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div
                    className={`text-[9px] mt-1 text-right font-medium opacity-75`}
                  >
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-100 border-t border-red-300 text-red-800 text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError("")}>
            <FiX className="text-sm" />
          </button>
        </div>
      )}

      {/* Attachment Preview Chip */}
      {attachedFile && (
        <div className="px-4 py-2 bg-[#09251C]/10 border-t border-[#09251C]/15 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 text-xs text-[#09251C]">
            <FiPaperclip className="shrink-0 text-[#A55704]" />
            <span className="font-semibold truncate">{attachedFile.name}</span>
            <span className="text-[10px] text-[#09251C]/60">
              ({formatFileSize(attachedFile.size)})
            </span>
          </div>
          <button
            onClick={() => setAttachedFile(null)}
            className="p-1 hover:bg-[#09251C]/15 rounded-lg text-[#09251C] transition"
          >
            <FiX className="text-sm" />
          </button>
        </div>
      )}

      {/* Message Input Bar */}
      <div className="p-3 sm:p-4 bg-[#F8EADC] border-t border-[#09251C]/15 shrink-0">
        <div className="flex items-end gap-2 bg-white/80 border border-[#09251C]/25 rounded-2xl p-2 shadow-sm focus-within:border-[#A55704] transition">
          {/* File attachment button */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            title="Attach file (Max 5 MB)"
            className="p-2 text-[#09251C]/70 hover:text-[#A55704] hover:bg-[#09251C]/5 rounded-xl transition shrink-0 disabled:opacity-50"
          >
            <FiPaperclip className="text-lg" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Auto-growing Text Input */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              uploading
                ? "Uploading attachment..."
                : isGroup
                ? "Send anonymous message (Enter to send)..."
                : "Type a message (Enter to send)..."
            }
            className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-[#09251C] placeholder-[#09251C]/50 resize-none max-h-32 focus:outline-none py-1.5 px-1"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={(!inputText.trim() && !attachedFile) || uploading}
            title="Send message"
            className="p-2.5 bg-[#A55704] hover:bg-[#8e4a03] text-[#F8EADC] rounded-xl transition shrink-0 shadow disabled:opacity-40 disabled:hover:bg-[#A55704]"
          >
            <FiSend className="text-base" />
          </button>
        </div>
      </div>
    </div>
  );
}
