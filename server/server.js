const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5050;


const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));




// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ✅ Mount auth routes
// ✅ Replace your old route mounting with this:
//try {
//  const authRoutes = require('./routes/auth');
//  app.use('/api/auth', authRoutes);
//} catch (err) {
//  console.error("🔥 Crash in /api/auth:", err.message);
//}

//try {
//  const userRoutes = require('./routes/user');
//  app.use('/api/user', userRoutes);
//} catch (err) {
//  console.error("🔥 Crash in /api/user:", err.message);
//}

//try {
//  const adminRoutes = require('./routes/admin');
//  app.use('/api/admin', adminRoutes);
//} catch (err) {
//  console.error("🔥 Crash in /api/admin:", err.message);
//}

//try {
//  const aiRoutes = require('./routes/cryptoAi');
//  app.use('/api/ai', aiRoutes);
//} catch (err) {
//  console.error("🔥 Crash in /api/ai:", err.message);
//}


// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => console.error('Mongo connection error:', err));

  //Option A – Use a Proxy Server (Recommended for production)
  const axios = require('axios');

app.get('/api/price/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch price', error: err.message });
  }
});


// app.use('/api/admin', adminRoutes); // ✅ This should be present


// Serve frontend for any unknown route
//app.get('*', (req, res) => {
//  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
//});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
