Component({
  properties: {
    provider: {
      type: Object,
      value: {},
      observer(v) {
        // 单价以H币展示（内部按元，1元=10H币）
        if (v && typeof v.price_per_minute === 'number') {
          this.setData({ priceCoins: getApp().toCoins(v.price_per_minute) })
        }
      }
    }
  },
  data: { priceCoins: '' },
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
