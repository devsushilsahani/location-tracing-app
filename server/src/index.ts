import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import locationRoutes from './routes/locationRouts';
import userRoutes from './routes/userRoutes';

// Load environment variables
dotenv.config();

// Create Express app
const app: express.Application = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', locationRoutes);
app.use('/api/user', userRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});