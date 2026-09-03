import axios from 'axios'

const http = axios.create({ baseURL: '/api/v1' })

// 列表通用分页/搜索参数
const listParams = (page, size, keyword) => ({
  params: { page: page || 1, page_size: size || 20, keyword: keyword || '' }
})

export default http

// 管理后台接口
export const getDashboard = () => http.get('/admin/dashboard')

// 服务者
export const getProviders = (page, size, keyword) => http.get('/admin/providers', listParams(page, size, keyword))
export const getApplications = (page, size, keyword) => http.get('/admin/providers/applications', listParams(page, size, keyword))
export const approveProvider = (id, approve, reason) =>
  http.put(`/admin/providers/${id}/approve`, { approve, reason })
export const updateProvider = (id, data) =>
  http.put(`/admin/providers/${id}/update`, data)
export const setProviderStatus = (id, status, isOnline, pricePerMinute) =>
  http.put(`/admin/providers/${id}/status`, { status, is_online: isOnline, price_per_minute: pricePerMinute })

// 订单财务
export const getCalls = (page, size, keyword) => http.get('/admin/orders/calls', listParams(page, size, keyword))
export const getRecharge = (page, size, keyword) => http.get('/admin/orders/recharge', listParams(page, size, keyword))
export const getWithdraws = (page, size, keyword) => http.get('/admin/withdraws', listParams(page, size, keyword))
export const updateWithdraw = (id, status, remark) =>
  http.put(`/admin/withdraws/${id}`, { status, remark })

// 用户
export const getUsers = (page, size, keyword) => http.get('/admin/users', listParams(page, size, keyword))

// 提示管理
export const getNotifications = (page, size, keyword) => http.get('/admin/notifications', listParams(page, size, keyword))
export const createNotification = (data) => http.post('/admin/notifications', data)
export const updateNotification = (id, data) => http.put(`/admin/notifications/${id}`, data)
export const deleteNotification = (id) => http.delete(`/admin/notifications/${id}`)
