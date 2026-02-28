const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from React build in production
// Only register static middleware if build directory exists to avoid ENOENT errors
const buildPath = path.join(__dirname, '../client/build');
if (process.env.NODE_ENV === 'production') {
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
  }
}

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, '../downloads');
fs.ensureDirSync(downloadsDir);

// Routes
app.use('/api/download', require('./routes/download'));
app.use('/api/info', require('./routes/info'));
app.use('/api/formats', require('./routes/formats'));

// Socket.io for real-time download progress
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Export io for use in routes
app.set('socketio', io);

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).send('Service temporarily unavailable. The application build is incomplete.');
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
