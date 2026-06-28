const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';
const TOKEN_KEY = 'exam_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    if (!path.startsWith('/api/auth/')) {
      window.location.href = '/login';
    }
    throw new Error('未登录或登录失效');
  }
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error((data && data.error) || `请求失败 (${res.status})`);
  return data;
}

export const login = (username, password) =>
  request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const register = (username, password) =>
  request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });

export const logout = () => request('/api/auth/logout', { method: 'POST' });

export const me = () => request('/api/auth/me');

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/upload', { method: 'POST', body: formData });
};

export const getQuestionBanks = () => request('/api/question-banks');

export const deleteQuestionBank = (bankId) =>
  request(`/api/question-banks/${bankId}`, { method: 'DELETE' });

export const getQuestions = (bankId, type = null) => {
  const params = new URLSearchParams({ bankId });
  if (type && type !== 'all') params.set('type', type);
  return request(`/api/questions?${params}`);
};

export const getQuestionTypes = (bankId) =>
  request(`/api/questions/types?bankId=${bankId}`);

export const submitAnswer = (questionId, userAnswer, selfJudge) => {
  const body = { questionId, userAnswer };
  if (typeof selfJudge === 'boolean') body.selfJudge = selfJudge;
  return request('/api/submit', { method: 'POST', body: JSON.stringify(body) });
};

export const getMistakes = (bankId = null, type = null) => {
  const params = new URLSearchParams();
  if (bankId) params.set('bankId', bankId);
  if (type && type !== 'all') params.set('type', type);
  const qs = params.toString();
  return request(`/api/mistakes${qs ? '?' + qs : ''}`);
};

export const getMistakeBanks = () => request('/api/mistakes/banks');

export const deleteMistake = (questionId) =>
  request(`/api/mistakes/${questionId}`, { method: 'DELETE' });

export const getStats = (bankId = null) => {
  const url = bankId ? `/api/stats?bankId=${bankId}` : '/api/stats';
  return request(url);
};

export const adminListUsers = () => request('/api/admin/users');
export const adminDeleteUser = (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' });
export const adminResetPassword = (id, password) =>
  request(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
