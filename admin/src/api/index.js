import axios from 'axios'

const http = axios.create({ baseURL: '/api/v1' })

// 请求拦截：自动携带管理员 token
http.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

// 响应拦截：解包后端 {code, data, msg}，业务错误抛错，401 跳登录
http.interceptors.response.use(
  res => {
    const body = res.data
    if (body && body.code !== 0) {
      const err = new Error(body.msg || '请求失败')
      err.msg = body.msg || ''
      return Promise.reject(err)
    }
    // 直接返回 data 字段，页面里用 res.list / res.total / res.token 等
    return body ? body.data : null
  },
  err => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  }
)

// 列表通用分页/搜索参数
const listParams = (page, size, keyword) => ({
  params: { page: page || 1, page_size: size || 20, keyword: keyword || '' }
})

export default http

// 登录
export const adminLogin = (username, password) => http.post('/admin/login', { username, password })

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
export const getTransfers = (page, size, keyword) => http.get('/admin/transfers', listParams(page, size, keyword))
export const queryTransfer = (id) => http.get(`/admin/transfers/${id}/query`)

// 用户
export const getUsers = (page, size, keyword) => http.get('/admin/users', listParams(page, size, keyword))

// 提示管理
export const getNotifications = (page, size, keyword) => http.get('/admin/notifications', listParams(page, size, keyword))
export const createNotification = (data) => http.post('/admin/notifications', data)
export const updateNotification = (id, data) => http.put(`/admin/notifications/${id}`, data)
export const deleteNotification = (id) => http.delete(`/admin/notifications/${id}`)
