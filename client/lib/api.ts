import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_SERVER_URL });

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export async function fetchAuditLogs(filters: {
  user?: string;
  branch?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const res = await api.get('/audit', { params: filters });
  return res.data; // { page, limit, total, logs }
}

export default api;
