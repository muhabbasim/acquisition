import bcrypt from 'bcrypt';
import logger from '../config/logger.js';
import { db } from '../config/database.js';
import { eq } from 'drizzle-orm';
import { users } from '../models/user.model.js';



export const hashPassword = async (password) =>  {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    logger.error(`Error hashing the password: ${error}`);
    throw Error('Error hasing');
  }
};

export const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    logger.error(`Error comparing passwords: ${error}`);
    throw new Error('Error comparing passwords');
  }
};

export const authenticateUser = async (email, password) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    logger.info(`User ${user.email} authenticated successfully`);
    return user;
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      // User-facing error, just rethrow
      throw error;
    }

    logger.error(`Error authenticating the user: ${error}`);
    throw new Error('Error authenticating user');
  }
};

export const createUser = async ({ name, email, password, role = 'user' }) => {
  try {

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if(existingUser.length > 0) {
      throw new Error('User already exist');
    }

    const hashedPassword = await hashPassword(password);

    const [ newUser ] = await db
      .insert(users)
      .values({ name, email, password: hashedPassword, role })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        created_at: users.created_at,
      });

    logger.info(`User ${newUser.email} created successfully`);
    return newUser;

  } catch (error) {
    logger.error(`Error creating the user: ${error}`);
    throw Error('Error hasing');
  }
};
