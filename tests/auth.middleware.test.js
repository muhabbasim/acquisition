import { jest } from '@jest/globals';
import { authenticateToken, requireRole } from '../src/middleware/auth.middleware.js';
import { jwtToken } from '../src/utils/jwt.js';

describe('authenticateToken middleware', () => {
  test('returns 401 when no token cookie is present', () => {
    const req = { cookies: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Authentication required' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches user to request and calls next when token is valid', () => {
    const userPayload = { id: 1, email: 'test@example.com', role: 'user' };
    const req = { cookies: { token: 'fake-token' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    const verifySpy = jest.spyOn(jwtToken, 'verify').mockReturnValue(userPayload);

    authenticateToken(req, res, next);

    expect(verifySpy).toHaveBeenCalledWith('fake-token');
    expect(req.user).toEqual(userPayload);
    expect(next).toHaveBeenCalled();

    verifySpy.mockRestore();
  });
});

describe('requireRole middleware', () => {
  test('returns 401 when user is not authenticated', () => {
    const middleware = requireRole(['admin']);
    const req = { user: undefined };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Authentication required' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when user role is not allowed', () => {
    const middleware = requireRole(['admin']);
    const req = { user: { email: 'user@example.com', role: 'user' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Access denied' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when user has an allowed role', () => {
    const middleware = requireRole(['admin', 'user']);
    const req = { user: { email: 'user@example.com', role: 'user' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
