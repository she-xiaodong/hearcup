import axios from 'axios'

const http = axios.create({ baseURL: '/api/v1' })

export default http

// 管理后台接口
export const getDashboard = () => http.get('/admin/dashboard')
export const getProviders = () => http.get('/admin/providers')
export const getApplications = () => http.get('/admin/providers/applications')
export const approveProvider = (id, approve, reason) =>
  http.put(`/admin/providers/${id}/approve`, { approve, reason })
export const updateProvider = (id, data) =>
  http.put(`/admin/providers/${id}/update`, data)
export const setProviderStatus = (id, status, isOnline, pricePerMinute) =>
  http.put(`/admin/providers/${id}/status`, { status, is_online: isOnline, price_per_minute: pricePerMinute })
