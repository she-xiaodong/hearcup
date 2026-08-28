Component({
  properties: {
    provider: { type: Object, value: {} }
  },
  methods: {
    onTapCard() {
      wx.navigateTo({ url: `/pages/detail/detail?id=${this.data.provider.id}` })
    },
    onCall(e) {
      const callType = Number(e.currentTarget.dataset.type)
      this.triggerEvent('call', { provider: this.data.provider, callType })
    }
  }
})
