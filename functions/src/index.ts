
import * as functions from "firebase-functions";
import express, { Request, Response } from "express";
import cors from "cors";
import * as logger from "firebase-functions/logger";

const app = express();

const allowedOrigins = [
    "https://studio-7147485763-c4a98.web.app",
    "https://mindtocare.com",
    "https://www.mindtocare.com",
    "https://studio--studio-7147485763-c4a98.us-central1.hosted.app",
    "http://localhost:3000",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn("CORS blocked for origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// Enable CORS with the specified options
app.use(cors(corsOptions));

// This is a placeholder for your actual API routes.
// The frontend seems to interact directly with Firebase services,
// but if you have HTTP endpoints, they would be defined here.
// For example:
// app.post('/join-chat', (req, res) => {
//   // Your logic here
//   res.status(200).send({ message: 'Chat joined' });
// });

// Default route to confirm the function is running
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("Cloud Function is running.");
});

// Expose the Express API as a single Cloud Function.
// Any request to this function will be handled by the Express app.
export const api = functions.https.onRequest(app);
