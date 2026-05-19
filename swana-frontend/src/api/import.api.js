import client from './client';

export const preview = (chatText, sourceFile) =>
  client.post('/import/preview', { chatText, sourceFile });

export const commit = (payload) =>
  client.post('/import/commit', payload);

export const jobs = () =>
  client.get('/import/jobs');

export const getKnowledge = () =>
  client.get('/import/knowledge');

export const savePayees = (payees) =>
  client.put('/import/knowledge/payees', { payees });

export const saveCategories = (categories) =>
  client.put('/import/knowledge/categories', { categories });
