import client from './client';

export const login = (username, pin) => client.post('/auth/login', { username, pin });
export const me    = ()              => client.get('/auth/me');
export const users = ()              => client.get('/auth/users');
