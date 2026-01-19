import logger from '../config/logger.js';
import {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
} from '../services/users.services.js';
import { formatValidationError } from '../utils/format.js';
import {
  updateUserSchema,
  userIdSchema,
} from '../validations/users.validation.js';

export const fetchAllUsrs = async (req, res, next) => {
  try {
    logger.info('Getting users...');

    const allUsers = await getAllUsers();

    res.json({
      message: 'Successfully retrieved users',
      usres: allUsers,
      count: allUsers.length,
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

export const fetchUserById = async (req, res, next) => {
  try {
    logger.info(`Getting user by id: ${req.params.id}`);

    // Validate the user ID parameter
    const validationResult = userIdSchema.safeParse({ id: req.params.id });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;
    const user = await getUser(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`User ${user.email} retrieved successfully`);
    res.json({
      message: 'Successfully retrieved user',
      user,
    });
  } catch (error) {
    logger.error(`Error fetching user by id: ${error.message}`);

    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    next(error);
  }
};

export const updateUserById = async (req, res, next) => {
  try {
    logger.info(`Updating user: ${req.params.id}`);

    // Validate the user ID parameter
    const idValidationResult = userIdSchema.safeParse({ id: req.params.id });

    if (!idValidationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(idValidationResult.error),
      });
    }

    // Validate the update data
    const updateValidationResult = updateUserSchema.safeParse(req.body);

    if (!updateValidationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(updateValidationResult.error),
      });
    }

    const { id } = idValidationResult.data;
    const updates = updateValidationResult.data;

    // Authorization checks
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to update user information',
      });
    }

    // Allow users to update only their own information (except role)
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own information',
      });
    }

    // Only admin users can change roles
    if (updates.role && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only administrators can change user roles',
      });
    }

    // Remove role from updates if non-admin user is trying to update their own profile
    if (req.user.role !== 'admin') {
      delete updates.role;
    }

    const updatedUser = await updateUser(id, updates);

    logger.info(`User ${updatedUser.email} updated successfully`);
    res.json({
      message: 'Successfully updated user',
      user: updatedUser,
    });
  } catch (error) {
    logger.error(`Error updating user: ${error.message}`);

    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    if (error.message === 'Email already exists') {
      return res.status(409).json({ error: 'Email already exists' });
    }

    next(error);
  }
};

export const deleteUserById = async (req, res, next) => {
  try {
    logger.info(`Deleting user: ${req.params.id}`);

    // Validate the user ID parameter
    const validationResult = userIdSchema.safeParse({ id: req.params.id });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;

    // Authorization checks
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to delete users',
      });
    }

    // Only admin users can delete users (prevent self-deletion or user deletion by non-admins)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only administrators can delete users',
      });
    }

    // Prevent admins from deleting themselves
    if (req.user.id === id) {
      return res.status(403).json({
        error: 'Operation denied',
        message: 'You cannot delete your own account',
      });
    }

    const deletedUser = await deleteUser(id);

    logger.info(`User ${deletedUser.email} deleted successfully`);
    res.json({
      message: 'User deleted successfully',
      user: deletedUser,
    });
  } catch (error) {
    logger.error(`Error deleting user: ${error.message}`);

    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    next(error);
  }
};
