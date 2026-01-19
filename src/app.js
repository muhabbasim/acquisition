import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import logger from './config/logger.js';
import authRouter from './routes/auth.routes.js';
import usersRouter from './routes/users.routes.js';
import securityMiddleware from './middleware/security.middlewar.js';

const app = express(); // Initializes your HTTP server. -- Everything (routes, middleware, error handling) attaches to this object.

// app.use(cors({
//   origin: ['http://localhost:3000'],
//   credentials: true,
// })); // Allows browsers to call your API from another domain -- without this Browser blocks requests (CORS error)

app.use(helmet()); // Security headers (VERY important) XSS (Cross-Site Scripting) -- Clickjacking, MIME sniffing, Unsafe iframe usage
app.use(cors()); // Allows browsers to call your API from another domain -- without this Browser blocks requests (CORS error)
app.use(express.json()); // Parses application/json request bodies. -- Makes data available in req.body.
app.use(express.urlencoded({ extended: true })); // express.urlencoded() – Parse form data
app.use(cookieParser()); // Parses cookies into req.cookies

//  user our logger to display morgan messages
// morgan + winston – Request logging (CRITICAL)
app.use(
  morgan('combined', {
    stream: { write: message => logger.info(message.trim()) },
  })
);

app.use(securityMiddleware);
app.get('/', (req, res) => {
  logger.info('Hello from Acquisitions!');
  res.status(200).send('Hello from Acquisitions!');
});

// health chech
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
app.get('/api', (req, res) => {
  res.status(200).json({ message: 'Aquisitions API is running!' });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
  });
});

export default app;

// relative import system ('./config/logger.js')
// absolute import system ('@/config/logger.js')
