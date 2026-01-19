import logger from '../config/logger.js';
import { createUser, authenticateUser } from '../services/auth.service.js';
import { cookies } from '../utils/cookies.js';
import { formatValidationError } from '../utils/format.js';
import { jwtToken } from '../utils/jwt.js';
import { signupSchema, signInSchema } from '../validations/autn.validation.js';

export const signUp = async (req, res, next) => {
  try {
    const validationResult = signupSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { name, email, role, password } = validationResult.data;
    const newUser = await createUser({ name, email, password, role });

    const token = jwtToken.sign({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });

    cookies.set(res, 'token', token);

    // Auth service
    logger.info(`User registeratoin successfully: ${email}`);
    res.status(201).json({
      message: 'User registered',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    logger.error('Signup error', error);

    if (error.message === 'User with this email already exist') {
      return res.status(409).json({ error: 'Email already exist' });
    }

    next(error); // forward this error to the next funtion
  }
};

export const signIn = async (req, res, next) => {
  try {
    const validationResult = signInSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { email, password } = validationResult.data;
    const user = await authenticateUser(email, password);

    const token = jwtToken.sign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    cookies.set(res, 'token', token);

    logger.info(`User login successfully: ${email}`);
    res.status(200).json({
      message: 'User logged in',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Signin error', error);

    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    next(error);
  }
};

export const signOut = async (req, res, next) => {
  try {
    cookies.clear(res, 'token');
    logger.info('User logout successfully');
    res.status(200).json({ message: 'User logged out' });
  } catch (error) {
    logger.error('Signout error', error);
    next(error);
  }
};
