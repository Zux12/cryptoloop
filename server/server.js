const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5050;
const adminRoutes = require('./routes/admin');


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ✅ Mount auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

app.get('/test-direct', (req, res) => {
  res.send('✅ Direct route is working!');
});

const userRoutes = require('./routes/user');
app.use('/api/user', userRoutes);

const aiRoutes = require('./routes/cryptoAi'); // ✅ NEW
app.use('/api/ai', aiRoutes); // ✅ NEW

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


app.use('/api/admin', adminRoutes); // ✅ This should be present
app.use(express.static('public')); // ✅ Serve frontend files

