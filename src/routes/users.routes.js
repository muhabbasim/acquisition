import express from 'express'
import { fetchAllUsrs, fetchUserById, updateUserById, deleteUserById } from '../controllers/users.controller.js'
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/get-users', authenticateToken, requireRole(['admin']), fetchAllUsrs)
router.get('/:id', authenticateToken, fetchUserById)
router.put('/:id', authenticateToken, updateUserById)
router.delete('/:id', authenticateToken, requireRole(['admin']), deleteUserById)

export default router
