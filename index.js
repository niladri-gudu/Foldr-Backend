import express from 'express';
import dotenv from 'dotenv';
import connectDB from './db/connect.js';
import { requireAuth, clerkMiddleware } from '@clerk/express';
import authRouter from './routes/auth/index.js';
import fileRouter from './routes/files/index.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(morgan('dev'));

app.use(clerkMiddleware())

const apiAuth = (req, res, next) => {
  if (!req.auth || !req.auth.userId) {
    return res.status(401).json({ 
      message: "Unauthorized",
      error: "Authentication required" 
    });
  }
  next();
};

app.get('/', (req, res) => {
  res.send("hellooooo")
})

app.use('/auth', requireAuth(), authRouter)
app.use('/file', apiAuth, fileRouter)

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server due to DB connection error.');
  }
};

startServer();
