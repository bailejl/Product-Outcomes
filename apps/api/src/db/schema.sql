-- Hello World Database Schema
-- migrations/001_create_messages_table.sql

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    key CHARACTER VARYING(100) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial Hello World message
INSERT INTO messages (key, content) 
VALUES ('hello_world', 'Hello World from the Database!')
ON CONFLICT (key) DO NOTHING;