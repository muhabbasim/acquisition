import request from 'supertest';
import { jest } from '@jest/globals';

// Mock the Arcjet-based security middleware so it doesn't call external services
jest.unstable_mockModule('../src/middleware/security.middlewar.js', () => ({
  default: (req, res, next) => next(),
}));

// Import the Express app after mocks are set up
const { default: app } = await import('../src/app.js');

describe('App basic routes', () => {
  test('GET / returns greeting', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello from Acquisitions!');
  });

  test('GET /health returns OK status payload', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
  });

  test('GET /api returns API running message', async () => {
    const res = await request(app).get('/api');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Aquisitions API is running!' });
  });

  test('GET unknown route returns 404 JSON error', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route not found' });
  });
});

describe('Auth routes validation and basic behaviour', () => {
  test('POST /api/auth/sign-up with invalid payload returns 400', async () => {
    // Missing name and invalid email
    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({
        email: 'not-an-email',
        password: '123',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    expect(res.body).toHaveProperty('details');
  });

  test('POST /api/auth/sign-in with invalid payload returns 400', async () => {
    // Missing password
    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({
        email: 'user@example.com',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    expect(res.body).toHaveProperty('details');
  });

  test('POST /api/auth/sign-out returns 200', async () => {
    const res = await request(app).post('/api/auth/sign-out');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'User logged out' });
  });
});


// describe('API endpoints', () => {
//   describe('GET / health', () => {
//     it('Should return health status', async () => {
//       const response = await request(app).get('/health').expect(200);

//       expect(response.body).toHaveProperty('status', 'OK')
//       expect(response.body).toHaveProperty('timestamp')
//       expect(response.body).toHaveProperty('uptime')
//     })
//   })

//   describe('GET / api', () => {
//     it('Should return API message', async () => {
//       const response = await request(app).get('/api').expect(200);

//       expect(response.body).toHaveProperty('message', 'Aquisitions API is running!')
//     })
//   })

//   describe('GET / nonexistant', () => {
//     it('Should return 404 non-existant routes', async () => {
//       const response = await request(app).get('/nonexistant').expect(404);

//       expect(response.body).toHaveProperty('error', 'Route not found')
//     })
//   })
// })