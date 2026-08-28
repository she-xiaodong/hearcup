// custom-tab-bar —— 自定义底部导航（聆心风格暖色底）
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', iconClass: 't-home' },
      { pagePath: '/pages/calls/calls', text: '通话', iconClass: 't-phone' },
      { pagePath: '/pages/profile/profile', text: '我的', iconClass: 't-user' }
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
