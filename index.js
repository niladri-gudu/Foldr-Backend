import express from 'express';
import dotenv from 'dotenv';
import connectDB from './db/connect.js';
import authRouter from './routes/auth/index.js';
import fileRouter from './routes/files/index.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import auth from './middlewares/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(cors({
  origin: [`${process.env.FRONTEND_URL}`, 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get('/', (req, res) => {
  res.send("hellooooo")
})

app.use('/auth', authRouter)
app.use('/file', auth, fileRouter)

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
