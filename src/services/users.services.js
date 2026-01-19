import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import logger from '../config/logger.js';
import { users } from '../models/user.model.js';

export const getAllUsers = async () => {
  try {
    return await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        created_at: users.created_at,
        updated_at: users.updated_at,
      })
      .from(users);
  } catch (error) {
    logger.error('Error getting users', error);
    throw error;
  }
};

export const getUser = async id => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        created_at: users.created_at,
        updated_at: users.updated_at,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user;
  } catch (error) {
    logger.error('Error getting user by id', error);
    throw error;
  }
};

export const updateUser = async (id, data) => {
  try {
    const existingUser = await getUser(id);

    // Check if email is being updated and if it already exists
    if (data.email && data.email !== existingUser.email) {
      const [emailExists] = await db
        .select()
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1);
      if (emailExists) {
        throw new Error('Email already exists');
      }
    }

    // Add updated_at timestamp
    const updateData = {
      ...data,
      updated_at: new Date(),
    };

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        created_at: users.created_at,
        updated_at: users.updated_at,
      });

    logger.info(`User ${updatedUser.email} updated successfully`);
    return updatedUser;
  } catch (error) {
    logger.error('Error updating user', error);
    throw error;
  }
};

export const deleteUser = async id => {
  try {
    // First check if user exists
    await getUser(id);

    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      });

    logger.info(`User ${deletedUser.email} deleted successfully`);
    return deletedUser;
  } catch (error) {
    logger.error('Error deleting user', error);
    throw error;
  }
};
