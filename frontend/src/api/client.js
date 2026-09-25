import axios from 'axios';
import { getCredentials } from '../utils/crypto';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use(async (config) => {
  const creds = await getCredentials();
  
  if (creds) {
    const { provider, apiKey, model, ollamaUrl } = creds;
    if (provider) config.headers['X-LLM-Provider'] = provider;
    if (apiKey) config.headers['X-LLM-API-Key'] = apiKey;
    if (model) config.headers['X-LLM-Model'] = model;
    if (ollamaUrl) config.headers['X-Ollama-URL'] = ollamaUrl;
  }

  return config;
});

// Auth & Health
export const validateCredentials = (data) => api.post('/auth/validate', data);
export const healthCheck = () => api.get('/health');
// Video Processing
export const processVideo = (data) => api.post('/process', data);
export const getStatus = (jobId) => api.get(`/status/${jobId}`);

// Clips
export const getClips = (params) => api.get('/clips', { params });
export const getClip = (id) => api.get(`/clips/${id}`);
export const deleteClip = (id) => api.delete(`/clips/${id}`);
export const downloadClip = (id) => api.get(`/clips/${id}/download`, { responseType: 'blob' });
export const trimClip = (id, data) => api.post(`/clips/${id}/trim`, data);

// Campaigns
export const getCampaigns = () => api.get('/campaigns');
export const createCampaign = (data) => api.post('/campaigns', data);
export const updateCampaign = (id, data) => api.put(`/campaigns/${id}`, data);
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}`);
export const classifyCampaigns = () => api.post('/campaigns/classify');
export const getCampaignClips = (id) => api.get(`/campaigns/${id}/clips`);

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);

export default api;
