// custom-tab-bar —— 自定义底部导航（聆心风格暖色底）
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', iconPath: '/images/tab_home.png', selectedIconPath: '/images/tab_home_on.png' },
      { pagePath: '/pages/calls/calls', text: '通话', iconPath: '/images/tab_phone.png', selectedIconPath: '/images/tab_phone_on.png' },
      { pagePath: '/pages/profile/profile', text: '我的', iconPath: '/images/tab_user.png', selectedIconPath: '/images/tab_user_on.png' }
    ]
  },
  methods: {
    switchTab(e) {
      const idx = e.currentTarget.dataset.index
      const url = this.data.list[idx].pagePath
      wx.switchTab({ url })
    }
  }
})
