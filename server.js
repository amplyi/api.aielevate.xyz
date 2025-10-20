import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();
const app = express();

app.use(express.json());
// Allow only your WP domains for POST requests
app.use(cors({
  origin: ['https://aielevate.xyz', 'https://www.aielevate.xyz'],
  methods: ['POST'],
  allowedHeaders: ['Content-Type'],
}));

// ... your routes and logic

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
