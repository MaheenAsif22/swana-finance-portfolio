import client from './client';

export const list     = () => client.get('/categories');
export const payees   = () => client.get('/categories/payees');
export const accounts = () => client.get('/categories/accounts');
