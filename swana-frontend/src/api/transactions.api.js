import client from './client';

export const list        = (p = {}) => client.get('/transactions', { params: p });
export const pending     = ()       => client.get('/transactions/pending');
export const getOne      = (id)     => client.get(`/transactions/${id}`);
export const create      = (data)   => client.post('/transactions', data);
export const approve     = (id)     => client.patch(`/transactions/${id}/approve`);
export const reject      = (id, reason) => client.patch(`/transactions/${id}/reject`, { reason });
export const bulkApprove = (ids)    => client.patch('/transactions/bulk/approve', { ids });
