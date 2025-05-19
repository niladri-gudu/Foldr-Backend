import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const uri = `${process.env.MONGO_URI}/${process.env.DB_NAME}`;
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.name}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    throw error;
  }
};

export default connectDB;
