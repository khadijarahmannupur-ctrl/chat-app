// ==========================================
// CONFIGURATION & IMPORTS
// ==========================================
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);


const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');

dotenv.config();

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'chat_app';

const app = express();
const server = http.createServer(app);

// CORS for Express
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads statically (Max 5MB files)
app.use('/uploads', express.static(uploadsDir));

// Socket.io initialization with CORS
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: 5 * 1024 * 1024
});

// ==========================================
// DATABASE (Native MongoDB Driver)
// ==========================================
let dbClient = null;
let db = null;

async function initDB() {
  try {
    dbClient = new MongoClient(MONGODB_URI);
    await dbClient.connect();
    db = dbClient.db(DB_NAME);
    console.log(`Connected to MongoDB database: ${DB_NAME}`);

    // Create required indexes
    await db.collection('messages').createIndex({ conversationId: 1, createdAt: 1 });
    await db.collection('conversations').createIndex({ members: 1 });
    console.log('MongoDB indexes ensured');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    console.log('Server is running, but database operations will wait until MongoDB is reachable.');
  }
}

// Helper: Convert string to ObjectId safely
function toObjectId(id) {
  if (ObjectId.isValid(id) && typeof id === 'string' && id.length === 24) {
    return new ObjectId(id);
  }
  return null;
}

// Helper: Find user in Better Auth's user collection
async function findUserById(userId) {
  if (!db || !userId) return null;
  const objId = toObjectId(userId);
  const query = objId ? { $or: [{ _id: objId }, { id: userId }, { _id: userId }] } : { $or: [{ id: userId }, { _id: userId }] };
  const user = await db.collection('user').findOne(query);
  if (!user) return null;
  return {
    id: user.id || user._id.toString(),
    name: user.name || 'Unknown',
    email: user.email || '',
    image: user.image || ''
  };
}

// ==========================================
// AUTH & SESSION VALIDATION
// ==========================================
// Forward request's cookie header to Next.js Better Auth get-session endpoint
async function validateSession(cookieHeader) {
  if (!cookieHeader) return null;
  try {
    const res = await fetch(`${FRONTEND_URL}/api/auth/get-session`, {
      headers: {
        cookie: cookieHeader
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.user) {
      return {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.image || ''
      };
    }
    return null;
  } catch (err) {
    console.error('Error forwarding session to Next.js:', err.message);
    return null;
  }
}

// Express Auth Middleware
const authMiddleware = async (req, res, next) => {
  const user = await validateSession(req.headers.cookie);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing session' });
  }
  req.user = user;
  next();
};

// ==========================================
// FILE UPLOADS (Multer - Max 5 MB, Random Filename)
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate random name with no user ID
    const ext = path.extname(file.originalname);
    const randomName = crypto.randomUUID() + ext;
    cb(null, randomName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit
});

// Upload Endpoint requires valid session
app.post('/api/upload', authMiddleware, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 5 MB limit' });
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({
      url: fileUrl,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size
    });
  });
});

// ==========================================
// REST ROUTES (Conversations, Messages, Users)
// ==========================================

// Root health check
app.get('/', (req, res) => {
  res.send('Chat App Backend Running');
});

// Search users by name or email (People search)
app.get('/api/users/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json([]);
    }
    const regex = new RegExp(q, 'i');
    const users = await db.collection('user')
      .find({
        $or: [{ name: regex }, { email: regex }]
      })
      .limit(20)
      .toArray();

    const results = users
      .map(u => ({
        id: u.id || u._id.toString(),
        name: u.name || 'Unknown',
        email: u.email || '',
        image: u.image || ''
      }))
      .filter(u => u.id !== req.user.id);

    res.json(results);
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// List conversations for current user with unread counts
app.get('/api/conversations', authMiddleware, async (req, res) => {
  try {
    const conversations = await db.collection('conversations')
      .find({ members: req.user.id })
      .sort({ updatedAt: -1 })
      .toArray();

    const formattedList = await Promise.all(
      conversations.map(async (conv) => {
        const convId = conv._id.toString();

        // Calculate unread count
        const unreadCount = await db.collection('messages').countDocuments({
          conversationId: convId,
          readBy: { $ne: req.user.id }
        });

        // HIDDEN SENDER RULE for group preview:
        // Do not include sender info in group last-message preview
        let lastMessagePreview = null;
        if (conv.lastMessage) {
          if (conv.type === 'group') {
            lastMessagePreview = {
              text: conv.lastMessage.text || '',
              hasAttachment: !!conv.lastMessage.hasAttachment,
              attachmentType: conv.lastMessage.attachmentType || null,
              createdAt: conv.lastMessage.createdAt
              // NO sender name / id
            };
          } else {
            lastMessagePreview = {
              text: conv.lastMessage.text || '',
              hasAttachment: !!conv.lastMessage.hasAttachment,
              attachmentType: conv.lastMessage.attachmentType || null,
              createdAt: conv.lastMessage.createdAt
            };
          }
        }

        if (conv.type === 'direct') {
          const otherUserId = conv.members.find(m => m !== req.user.id);
          const otherUser = await findUserById(otherUserId);
          return {
            id: convId,
            type: 'direct',
            name: otherUser ? otherUser.name : 'Unknown User',
            image: otherUser ? otherUser.image : '',
            otherUserId,
            members: conv.members,
            unreadCount,
            lastMessage: lastMessagePreview,
            updatedAt: conv.updatedAt || conv.createdAt
          };
        } else {
          return {
            id: convId,
            type: 'group',
            name: conv.name,
            adminId: conv.adminId,
            members: conv.members,
            unreadCount,
            lastMessage: lastMessagePreview,
            updatedAt: conv.updatedAt || conv.createdAt
          };
        }
      })
    );

    res.json(formattedList);
  } catch (err) {
    console.error('Fetch conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Start or retrieve a direct 1-to-1 conversation
app.post('/api/conversations/direct', authMiddleware, async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId || typeof recipientId !== 'string') {
      return res.status(400).json({ error: 'Recipient ID is required' });
    }
    if (recipientId === req.user.id) {
      return res.status(400).json({ error: 'Cannot chat with yourself' });
    }

    const recipient = await findUserById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    // Check if direct conversation already exists
    let conversation = await db.collection('conversations').findOne({
      type: 'direct',
      members: { $all: [req.user.id, recipientId], $size: 2 }
    });

    if (!conversation) {
      const now = new Date();
      const insertResult = await db.collection('conversations').insertOne({
        type: 'direct',
        members: [req.user.id, recipientId],
        createdAt: now,
        updatedAt: now,
        lastMessage: null
      });
      conversation = {
        _id: insertResult.insertedId,
        type: 'direct',
        members: [req.user.id, recipientId],
        createdAt: now,
        updatedAt: now,
        lastMessage: null
      };
    }

    res.json({
      id: conversation._id.toString(),
      type: 'direct',
      name: recipient.name,
      image: recipient.image,
      otherUserId: recipientId,
      members: conversation.members,
      unreadCount: 0,
      lastMessage: conversation.lastMessage
    });
  } catch (err) {
    console.error('Direct conversation error:', err);
    res.status(500).json({ error: 'Failed to start direct conversation' });
  }
});

// Create a group conversation
app.post('/api/conversations/group', authMiddleware, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ error: 'memberIds must be an array' });
    }

    // Ensure creator is in members and IDs are unique strings
    const uniqueMembers = Array.from(new Set([req.user.id, ...memberIds.filter(id => typeof id === 'string' && id.trim())]));
    if (uniqueMembers.length < 2) {
      return res.status(400).json({ error: 'Group must have at least 2 members' });
    }

    const now = new Date();
    const result = await db.collection('conversations').insertOne({
      type: 'group',
      name: name.trim().slice(0, 50),
      adminId: req.user.id,
      members: uniqueMembers,
      createdAt: now,
      updatedAt: now,
      lastMessage: null
    });

    const newGroup = {
      id: result.insertedId.toString(),
      type: 'group',
      name: name.trim().slice(0, 50),
      adminId: req.user.id,
      members: uniqueMembers,
      unreadCount: 0,
      lastMessage: null,
      updatedAt: now
    };

    // Notify all members via Socket
    uniqueMembers.forEach(memberId => {
      io.to(`user:${memberId}`).emit('conversation_created', newGroup);
    });

    res.status(201).json(newGroup);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get conversation details & members
app.get('/api/conversations/:id', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.id;
    const objId = toObjectId(convId);
    const conv = await db.collection('conversations').findOne(
      objId ? { $or: [{ _id: objId }, { _id: convId }] } : { _id: convId }
    );

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (!conv.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Populate members details for group management
    const memberDetails = await Promise.all(
      conv.members.map(async (mId) => {
        const u = await findUserById(mId);
        return u || { id: mId, name: 'Unknown', email: '', image: '' };
      })
    );

    if (conv.type === 'direct') {
      const otherUser = memberDetails.find(m => m.id !== req.user.id) || { name: 'Unknown', image: '' };
      return res.json({
        id: conv._id.toString(),
        type: 'direct',
        name: otherUser.name,
        image: otherUser.image,
        otherUserId: otherUser.id,
        members: conv.members,
        memberDetails
      });
    }

    res.json({
      id: conv._id.toString(),
      type: 'group',
      name: conv.name,
      adminId: conv.adminId,
      members: conv.members,
      memberDetails
    });
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Admin adds members to a group
app.post('/api/conversations/:id/members/add', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.id;
    const { memberIds } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'memberIds array is required' });
    }

    const objId = toObjectId(convId);
    const conv = await db.collection('conversations').findOne(
      objId ? { $or: [{ _id: objId }, { _id: convId }] } : { _id: convId }
    );

    if (!conv || conv.type !== 'group') {
      return res.status(404).json({ error: 'Group conversation not found' });
    }
    if (conv.adminId !== req.user.id) {
      return res.status(403).json({ error: 'Only the group admin can add members' });
    }

    const validNewIds = memberIds.filter(id => typeof id === 'string' && id.trim());
    await db.collection('conversations').updateOne(
      { _id: conv._id },
      { $addToSet: { members: { $each: validNewIds } } }
    );

    const updatedMembers = Array.from(new Set([...conv.members, ...validNewIds]));

    // Notify all members
    updatedMembers.forEach(memberId => {
      io.to(`user:${memberId}`).emit('group_members_updated', {
        conversationId: conv._id.toString(),
        members: updatedMembers
      });
    });

    res.json({ success: true, members: updatedMembers });
  } catch (err) {
    console.error('Add group members error:', err);
    res.status(500).json({ error: 'Failed to add members' });
  }
});

// Admin removes a member from a group
app.post('/api/conversations/:id/members/remove', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.id;
    const { memberId } = req.body;
    if (!memberId || typeof memberId !== 'string') {
      return res.status(400).json({ error: 'memberId is required' });
    }

    const objId = toObjectId(convId);
    const conv = await db.collection('conversations').findOne(
      objId ? { $or: [{ _id: objId }, { _id: convId }] } : { _id: convId }
    );

    if (!conv || conv.type !== 'group') {
      return res.status(404).json({ error: 'Group conversation not found' });
    }
    if (conv.adminId !== req.user.id) {
      return res.status(403).json({ error: 'Only the group admin can remove members' });
    }
    if (memberId === conv.adminId) {
      return res.status(400).json({ error: 'Admin cannot be removed from the group' });
    }

    await db.collection('conversations').updateOne(
      { _id: conv._id },
      { $pull: { members: memberId } }
    );

    const updatedMembers = conv.members.filter(m => m !== memberId);

    // Notify remaining and removed members
    conv.members.forEach(m => {
      io.to(`user:${m}`).emit('group_members_updated', {
        conversationId: conv._id.toString(),
        members: updatedMembers,
        removedMemberId: memberId
      });
    });

    res.json({ success: true, members: updatedMembers });
  } catch (err) {
    console.error('Remove group member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Fetch messages for a conversation
// CORE RULE: For GROUP chats, never return senderId/name/image! Only return isMine: true/false.
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.id;
    const objId = toObjectId(convId);
    const conv = await db.collection('conversations').findOne(
      objId ? { $or: [{ _id: objId }, { _id: convId }] } : { _id: convId }
    );

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (!conv.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await db.collection('messages')
      .find({ conversationId: conv._id.toString() })
      .sort({ createdAt: 1 })
      .toArray();

    // Reset unread count for this user
    await db.collection('messages').updateMany(
      { conversationId: conv._id.toString(), readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );

    const isGroup = conv.type === 'group';

    // Format messages according to HIDDEN SENDER RULE
    let formattedMessages;
    if (isGroup) {
      formattedMessages = messages.map(msg => ({
        id: msg._id.toString(),
        conversationId: msg.conversationId,
        text: msg.text,
        attachment: msg.attachment,
        createdAt: msg.createdAt,
        isMine: msg.senderId === req.user.id
        // SenderId / senderName / senderImage completely omitted!
      }));
    } else {
      // Direct chat: show sender info normally
      const senderCache = {};
      formattedMessages = await Promise.all(
        messages.map(async (msg) => {
          if (!senderCache[msg.senderId]) {
            senderCache[msg.senderId] = await findUserById(msg.senderId);
          }
          const sender = senderCache[msg.senderId] || { name: 'User', image: '' };
          return {
            id: msg._id.toString(),
            conversationId: msg.conversationId,
            text: msg.text,
            attachment: msg.attachment,
            createdAt: msg.createdAt,
            sender: {
              id: msg.senderId,
              name: sender.name,
              image: sender.image
            },
            isMine: msg.senderId === req.user.id
          };
        })
      );
    }

    res.json(formattedMessages);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark conversation as read (reset unread badge)
app.post('/api/conversations/:id/read', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.id;
    await db.collection('messages').updateMany(
      { conversationId: convId, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// ==========================================
// SOCKET.IO REAL-TIME MESSAGING
// ==========================================
// Authenticate socket handshake by forwarding cookie header to Next.js get-session
io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      return next(new Error('Authentication error: Missing cookies'));
    }
    const user = await validateSession(cookieHeader);
    if (!user) {
      return next(new Error('Authentication error: Invalid session'));
    }
    socket.user = user;
    next();
  } catch (err) {
    return next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  // Join personal user room
  socket.join(`user:${userId}`);

  // Send message event handler
  socket.on('send_message', async (data, callback) => {
    try {
      const { conversationId, text, attachment } = data || {};
      if (!conversationId || typeof conversationId !== 'string') {
        if (callback) callback({ error: 'Valid conversationId is required' });
        return;
      }

      const trimmedText = (text || '').trim();
      if (!trimmedText && !attachment) {
        if (callback) callback({ error: 'Message cannot be empty' });
        return;
      }

      // Check conversation membership
      const objId = toObjectId(conversationId);
      const conv = await db.collection('conversations').findOne(
        objId ? { $or: [{ _id: objId }, { _id: conversationId }] } : { _id: conversationId }
      );

      if (!conv || !conv.members.includes(userId)) {
        if (callback) callback({ error: 'Not a member of this conversation' });
        return;
      }

      const now = new Date();
      const messageDoc = {
        conversationId: conv._id.toString(),
        senderId: userId, // Stored in DB
        text: trimmedText,
        attachment: attachment ? {
          url: attachment.url,
          name: attachment.name,
          type: attachment.type,
          size: attachment.size
        } : null,
        readBy: [userId],
        createdAt: now
      };

      const result = await db.collection('messages').insertOne(messageDoc);
      const messageId = result.insertedId.toString();

      // Update conversation's lastMessage and updatedAt
      await db.collection('conversations').updateOne(
        { _id: conv._id },
        {
          $set: {
            updatedAt: now,
            lastMessage: {
              text: trimmedText,
              hasAttachment: !!attachment,
              attachmentType: attachment?.type || null,
              createdAt: now
            }
          }
        }
      );

      const isGroup = conv.type === 'group';

      if (isGroup) {
        // HIDDEN SENDER RULE for group messages:
        // Never send senderId, sender name or sender image to clients.
        // Emit to each member's personal room with their specific isMine value.
        conv.members.forEach(memberId => {
          const payload = {
            id: messageId,
            conversationId: conv._id.toString(),
            text: messageDoc.text,
            attachment: messageDoc.attachment,
            createdAt: messageDoc.createdAt,
            isMine: memberId === userId
          };
          io.to(`user:${memberId}`).emit('new_message', payload);

          // Emit preview update (no sender name in preview for groups)
          io.to(`user:${memberId}`).emit('conversation_preview_update', {
            conversationId: conv._id.toString(),
            lastMessage: {
              text: messageDoc.text,
              hasAttachment: !!attachment,
              attachmentType: attachment?.type || null,
              createdAt: messageDoc.createdAt
            },
            updatedAt: now,
            senderId: memberId === userId ? null : 'other'
          });
        });
      } else {
        // Direct chat: include sender details
        const sender = await findUserById(userId);
        const otherMemberId = conv.members.find(m => m !== userId);

        const senderPayload = {
          id: messageId,
          conversationId: conv._id.toString(),
          text: messageDoc.text,
          attachment: messageDoc.attachment,
          createdAt: messageDoc.createdAt,
          sender: {
            id: userId,
            name: sender?.name || 'You',
            image: sender?.image || ''
          },
          isMine: true
        };

        const recipientPayload = {
          id: messageId,
          conversationId: conv._id.toString(),
          text: messageDoc.text,
          attachment: messageDoc.attachment,
          createdAt: messageDoc.createdAt,
          sender: {
            id: userId,
            name: sender?.name || 'User',
            image: sender?.image || ''
          },
          isMine: false
        };

        socket.emit('new_message', senderPayload);
        if (otherMemberId) {
          io.to(`user:${otherMemberId}`).emit('new_message', recipientPayload);
        }

        // Emit preview update
        conv.members.forEach(mId => {
          io.to(`user:${mId}`).emit('conversation_preview_update', {
            conversationId: conv._id.toString(),
            lastMessage: {
              text: messageDoc.text,
              hasAttachment: !!attachment,
              attachmentType: attachment?.type || null,
              createdAt: messageDoc.createdAt
            },
            updatedAt: now,
            senderId: mId === userId ? null : 'other'
          });
        });
      }

      if (callback) {
        callback({ success: true, messageId });
      }
    } catch (err) {
      console.error('Socket send_message error:', err);
      if (callback) callback({ error: 'Failed to send message' });
    }
  });

  socket.on('mark_read', async (data) => {
    try {
      const { conversationId } = data || {};
      if (conversationId) {
        await db.collection('messages').updateMany(
          { conversationId, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
      }
    } catch (err) {
      console.error('Socket mark_read error:', err);
    }
  });

  socket.on('disconnect', () => {
    // Left rooms automatically
  });
});

// ==========================================
// SERVER INITIALIZATION
// ==========================================
async function startServer() {
  await initDB();
  server.listen(PORT, () => {
    console.log(`Chat App Express & Socket.io server running on http://localhost:${PORT}`);
  });
}

startServer();