const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/exercise-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true }
});

const exerciseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const newUser = new User({ username });
    const savedUser = await newUser.save();
    res.json({ username: savedUser.username, _id: savedUser._id });
  } catch (err) {
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Add exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const { _id } = req.params;
    let { description, duration, date } = req.body;
    
    // Validate required fields
    if (!description || !duration) {
      return res.status(400).json({ error: 'Description and duration are required' });
    }
    
    // Validate user exists
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Parse duration to number
    duration = parseInt(duration);
    if (isNaN(duration)) {
      return res.status(400).json({ error: 'Duration must be a number' });
    }
    
    // Parse date or use current date
    const exerciseDate = date ? new Date(date) : new Date();
    if (isNaN(exerciseDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    // Create exercise
    const exercise = new Exercise({
      userId: _id,
      description,
      duration,
      date: exerciseDate
    });
    
    await exercise.save();
    
    res.json({
      _id: user._id,
      username: user.username,
      date: exerciseDate.toDateString(),
      duration,
      description
    });
  } catch (err) {
    res.status(500).json({ error: 'Error adding exercise' });
  }
});

// Get exercise log
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { _id } = req.params;
    const { from, to, limit } = req.query;
    
    // Validate user exists
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build query
    const query = { userId: _id };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    
    // Get exercises with optional limit
    let exercises = Exercise.find(query).select('description duration date -_id');
    if (limit) {
      exercises = exercises.limit(parseInt(limit));
    }
    
    const result = await exercises.exec();
    
    // Format response
    const log = result.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString()
    }));
    
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching exercise log' });
  }
});

// Start server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});