import { Hono } from 'hono';

const test = new Hono();

test.get('/ping', (c) => {
  return c.json({ message: 'pong' });
});

export default test;