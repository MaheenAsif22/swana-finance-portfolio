import client from './client';
import { today, daysAgo } from '../utils/format';

export const daily       = (date = today())                     => client.get('/reports/daily',   { params: { date } });
export const summary     = (from = daysAgo(30), to = today())   => client.get('/reports/summary', { params: { from, to } });
export const getBalance  = (date = today())                     => client.get('/reports/balance',  { params: { date } });
export const postBalance = (amount, account_id = 1)             => client.post('/reports/balance', { amount, account_id });
