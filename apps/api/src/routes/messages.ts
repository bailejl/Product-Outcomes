import { Router } from 'express';
import { MessageRepository } from '@product-outcomes/database';

const router = Router();
const messageRepository = new MessageRepository();

// GET /api/messages/hello-world - Original endpoint for backward compatibility
router.get('/hello-world', async (req, res) => {
  try {
    // Try to get from database first
    const message = await messageRepository.getHelloWorldMessage();
    
    if (message) {
      res.json({
        message: message.content,
        source: 'database',
        id: message.id,
        timestamp: message.createdAt
      });
    } else {
      // Fallback to static message
      res.json({
        message: 'Hello World from Product Outcomes API!',
        source: 'static',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error fetching hello-world message:', error);
    res.status(500).json({
      error: 'Failed to fetch message',
      message: 'Hello World from Product Outcomes API (fallback)!',
      source: 'fallback',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/messages - Get all messages
router.get('/', async (req, res) => {
  try {
    const messages = await messageRepository.findAll();
    res.json({
      messages,
      count: messages.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      error: 'Failed to fetch messages',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/messages/:id - Get message by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const message = await messageRepository.findById(id);
    
    if (!message) {
      return res.status(404).json({
        error: 'Message not found',
        id,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(message);
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({
      error: 'Failed to fetch message',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/messages - Create new message
router.post('/', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Content is required and must be a string',
        timestamp: new Date().toISOString()
      });
    }
    
    const message = await messageRepository.create(content);
    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({
      error: 'Failed to create message',
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/messages/:id - Update message
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Content is required and must be a string',
        timestamp: new Date().toISOString()
      });
    }
    
    const message = await messageRepository.update(id, content);
    
    if (!message) {
      return res.status(404).json({
        error: 'Message not found',
        id,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(message);
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({
      error: 'Failed to update message',
      timestamp: new Date().toISOString()
    });
  }
});

// DELETE /api/messages/:id - Delete message
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await messageRepository.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Message not found',
        id,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      error: 'Failed to delete message',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;