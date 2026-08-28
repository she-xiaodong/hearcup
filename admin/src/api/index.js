import axios from 'axios'

const http = axios.create({ baseURL: '/api/v1' })

export default http

// 管理后台接口（对应需求 5.6）
export const getDashboard = () => http.get('/admin/dashboard')
export const getProviders = () => http.get('/admin/providers')
export const getApplications = () => http.get('/admin/providers/applications')
export const approveProvider = (id, pass, reason) =>
  http.put(`/admin/providers/${id}/approve`, { pass, reason })
export const setProviderStatus = (id, status) =>
  http.put(`/admin/providers/${id}/status`, { status })
