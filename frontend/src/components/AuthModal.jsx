"use client";

import { useState, useRef } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { FiUser, FiMail, FiLock, FiUpload, FiCheck, FiAlertCircle } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";

// Client-side image resize helper
function resizeImageToDataURL(file, maxDim = 128, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AuthModal({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }
    try {
      const dataUrl = await resizeImageToDataURL(file, 140, 0.8);
      setImagePreview(dataUrl);
      setImageDataUrl(dataUrl);
      setError("");
    } catch (err) {
      setError("Failed to process selected image");
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let token = null;
      if (isLogin) {
        // Sign In
        const res = await signIn.email({
          email: email.trim(),
          password,
        });
        if (res.error) {
          setError(res.error.message || "Invalid credentials");
          setLoading(false);
          return;
        }
        token = res.data?.token || res.data?.session?.token;
      } else {
        // Sign Up
        if (!name.trim()) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        const res = await signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          image: imageDataUrl || "",
        });
        if (res.error) {
          setError(res.error.message || "Signup failed");
          setLoading(false);
          return;
        }
        token = res.data?.token || res.data?.session?.token;
      }

      if (token) {
        localStorage.setItem("bearer_token", token);
      } else if (!localStorage.getItem("bearer_token")) {
        try {
          const tokenRes = await fetch("/api/auth/token");
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData?.token) {
              localStorage.setItem("bearer_token", tokenData.token);
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await signIn.social({
        provider: "google",
        callbackURL: window.location.origin,
      });
    } catch (err) {
      setError(err.message || "Google sign in failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09251C]/60 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#F8EADC] border-2 border-[#09251C] rounded-2xl shadow-2xl p-5 sm:p-8 flex flex-col gap-4 sm:gap-6 text-[#09251C]">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#09251C] text-[#F8EADC] mb-3">
              <span className="font-bold text-xl">EC</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {isLogin ? "Welcome Back" : "Create Your Account"}
            </h2>
            <p className="text-xs sm:text-sm text-[#09251C]/70 mt-1">
              {isLogin
                ? "Sign in to access your chats and messages"
                : "Join our calm, minimal chat space"}
            </p>
          </div>

          {/* Tab switch */}
          <div className="flex bg-[#09251C]/10 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError("");
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isLogin
                ? "bg-[#09251C] text-[#F8EADC] shadow"
                : "text-[#09251C]/70 hover:text-[#09251C]"
                }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError("");
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isLogin
                ? "bg-[#09251C] text-[#F8EADC] shadow"
                : "text-[#09251C]/70 hover:text-[#09251C]"
                }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-xs font-medium">
              <FiAlertCircle className="shrink-0 text-base" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
            {!isLogin && (
              <>
                {/* Profile image picker */}
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-full border-2 border-dashed border-[#A55704] bg-[#09251C]/5 flex items-center justify-center cursor-pointer overflow-hidden shrink-0 hover:bg-[#09251C]/10 transition"
                    title="Pick profile picture"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FiUpload className="text-[#A55704] text-xl" />
                    )}
                  </div>
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-[#A55704] hover:underline block"
                    >
                      {imagePreview ? "Change avatar" : "Upload avatar"}
                    </button>
                    <span className="text-[11px] text-[#09251C]/60 block mt-0.5">
                      Resized automatically on your device
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name</label>
                  <div className="relative flex items-center">
                    <FiUser className="absolute left-3 text-[#09251C]/50" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-9 pr-3 py-2.5 bg-white/70 border border-[#09251C]/20 rounded-xl text-sm focus:outline-none focus:border-[#A55704] focus:ring-1 focus:ring-[#A55704]"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold mb-1">Email Address</label>
              <div className="relative flex items-center">
                <FiMail className="absolute left-3 text-[#09251C]/50" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-white/70 border border-[#09251C]/20 rounded-xl text-sm focus:outline-none focus:border-[#A55704] focus:ring-1 focus:ring-[#A55704]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold mb-1">Password</label>
              <div className="relative flex items-center">
                <FiLock className="absolute left-3 text-[#09251C]/50" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-white/70 border border-[#09251C]/20 rounded-xl text-sm focus:outline-none focus:border-[#A55704] focus:ring-1 focus:ring-[#A55704]"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-[#A55704] hover:bg-[#8e4a03] text-[#F8EADC] font-semibold text-sm rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow disabled:opacity-50"
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-[#09251C]/20 w-full" />
            <span className="bg-[#F8EADC] px-3 text-[11px] uppercase tracking-wider text-[#09251C]/60 absolute">
              or continue with
            </span>
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 bg-white/80 hover:bg-white border border-[#09251C]/20 text-[#09251C] font-semibold text-sm rounded-xl transition flex items-center justify-center gap-3 shadow-sm"
          >
            <FcGoogle className="text-xl" />
            <span>Google</span>
          </button>
        </div>
      </div>
    </div>
  );
}
